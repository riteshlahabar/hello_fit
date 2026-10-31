import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload, Audience } from '../auth/auth.types';
import {
  AUDIENCE_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/auth.decorators';
import { ErrorCode } from '../errors/error-codes';
import type { EnvVars } from '../../config/env.validation';

/**
 * Applied globally, so every route is authenticated unless marked @Public().
 * Verifies the access token only — no database read on the hot path.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'Authentication required',
      });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof TokenExpiredError
          ? { code: ErrorCode.TOKEN_EXPIRED, message: 'Access token expired' }
          : { code: ErrorCode.TOKEN_INVALID, message: 'Invalid access token' },
      );
    }

    const required = this.reflector.getAllAndOverride<Audience>(AUDIENCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && payload.aud !== required) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Token is not valid for this endpoint',
      });
    }

    request.user = {
      id: payload.sub,
      audience: payload.aud,
      roles: payload.roles ?? [],
      role: payload.role,
      permissions: payload.perms ?? [],
      branchId: payload.branchId ?? null,
      deviceId: payload.deviceId,
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
