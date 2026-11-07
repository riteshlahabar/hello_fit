import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentService } from './assignment.service';

/**
 * Expires offers nobody answered and cascades to the next candidate
 * (spec 3.3, "on decline or expiry it cascades to the next").
 *
 * Postgres holds the deadline (`assignments.expires_at`) rather than a Redis
 * timer, so a restart cannot drop a pending offer. When BullMQ arrives this
 * becomes one delayed job per offer for second-level precision; the cron
 * stays as the backstop.
 */
@Injectable()
export class OfferExpiryService {
  private readonly logger = new Logger(OfferExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleOffers(): Promise<void> {
    const now = new Date();

    const stale = await this.prisma.assignment.findMany({
      where: { response: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, sessionId: true, instructorId: true },
      take: 100,
    });

    if (stale.length === 0) return;

    await this.prisma.assignment.updateMany({
      where: { id: { in: stale.map((o) => o.id) } },
      data: { response: 'EXPIRED', respondedAt: now },
    });

    this.logger.log(`Expired ${stale.length} unanswered offer(s)`);

    // Cascade one session at a time. Sequential on purpose: two cascades for
    // the same session would create two competing pending offers.
    const sessionIds = [...new Set(stale.map((o) => o.sessionId))];

    for (const sessionId of sessionIds) {
      await this.assignment.cascade(sessionId);
    }
  }
}
