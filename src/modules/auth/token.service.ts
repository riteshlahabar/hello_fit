import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import type {
  AccessTokenPayload,
  Audience,
} from '../../common/auth/auth.types';
import type { EnvVars } from '../../config/env.validation';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvVars, true>,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Issues an access/refresh pair and persists the refresh token's hash.
   * SHA-256 rather than bcrypt here: the token is 48 random bytes, so it needs
   * no work factor, and lookup must be an indexed equality match.
   */
  async issuePair(
    payload: Omit<AccessTokenPayload, 'aud'> & { aud: Audience },
    deviceId?: string,
  ): Promise<TokenPair> {
    const jti = randomUUID();
    const raw = randomBytes(48).toString('hex');
    const refreshTtlDays = this.refreshTtlDays();

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        // Exactly one of these is set; which one depends on the audience.
        userId: payload.aud === 'app' ? payload.sub : null,
        adminUserId: payload.aud === 'admin' ? payload.sub : null,
        tokenHash: this.hash(raw),
        deviceId,
        expiresAt: new Date(Date.now() + refreshTtlDays * 86_400_000),
      },
    });

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });

    // The refresh token the client holds is the raw secret plus its row id, so
    // rotation can find the exact row without a table scan.
    return {
      accessToken,
      refreshToken: `${jti}.${raw}`,
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    };
  }

  /**
   * Rotates a refresh token. A token presented after it was already rotated
   * means the client's copy was stolen, so the whole chain for that user is
   * revoked rather than just rejecting the request (spec 10.1).
   */
  async rotate(
    presented: string,
    buildPayload: (
      subjectId: string,
      audience: Audience,
    ) => Promise<AccessTokenPayload>,
  ): Promise<TokenPair> {
    const [jti, raw] = presented.split('.');

    // The id half must be a UUID before it reaches the query: a uuid column
    // rejects anything else at the database level, which would surface as a
    // 500 rather than an authentication failure.
    if (!jti || !raw || !UUID_PATTERN.test(jti)) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: jti },
    });

    if (!record || record.tokenHash !== this.hash(raw)) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    const audience: Audience = record.adminUserId ? 'admin' : 'app';
    const subjectId = record.adminUserId ?? record.userId;

    if (!subjectId) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    if (record.replacedById || record.revokedAt) {
      // Replay of a rotated token: the client's copy leaked. Kill the chain.
      await this.revokeAllForSubject(subjectId, audience);
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Refresh token already used. Please sign in again.',
      });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Refresh token expired. Please sign in again.',
      });
    }

    const payload = await buildPayload(subjectId, audience);
    const next = await this.issuePair(payload, record.deviceId ?? undefined);

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: {
        revokedAt: new Date(),
        replacedById: next.refreshToken.split('.')[0],
      },
    });

    return next;
  }

  /**
   * Logout — revokes the presented token only. A malformed token is a no-op
   * rather than an error: the caller's intent is "end this session", and
   * logout should never fail loudly.
   */
  async revoke(presented: string): Promise<void> {
    const [jti] = presented.split('.');
    if (!jti || !UUID_PATTERN.test(jti)) return;

    await this.prisma.refreshToken.updateMany({
      where: { id: jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Logout everywhere, and the response to a detected token replay. */
  async revokeAllForSubject(
    subjectId: string,
    audience: Audience,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where:
        audience === 'admin'
          ? { adminUserId: subjectId, revokedAt: null }
          : { userId: subjectId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private refreshTtlDays(): number {
    const ttl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const match = /^(\d+)d$/.exec(ttl);
    return match ? Number(match[1]) : 30;
  }
}
