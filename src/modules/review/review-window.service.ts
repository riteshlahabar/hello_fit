import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ReviewService } from './review.service';

/**
 * Closes the review window (spec 4.4): publishes what was submitted, marks as
 * EXPIRED the sessions where nobody wrote anything, and moves earnings from
 * PENDING to PAYABLE once their dispute window has passed (spec 3.7).
 *
 * Hourly rather than per-minute: these windows are measured in days, so there
 * is nothing to gain from checking more often.
 */
@Injectable()
export class ReviewWindowService {
  private readonly logger = new Logger(ReviewWindowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly reviews: ReviewService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.publishClosedWindows();
    await this.expireUnwritten();
    await this.releasePayableEarnings();
  }

  /** Publishes reviews whose window has closed without the other side. */
  private async publishClosedWindows(): Promise<void> {
    const { windowDays } = this.settings.get('review');
    const cutoff = new Date(Date.now() - windowDays * 86_400_000);

    const sessions = await this.prisma.bookingSession.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lte: cutoff },
        reviews: { some: { state: 'SUBMITTED', deletedAt: null } },
      },
      select: { id: true },
      take: 200,
    });

    for (const session of sessions) {
      try {
        await this.reviews.tryPublish(session.id);
      } catch (error) {
        this.logger.error(
          `Failed to publish reviews for session ${session.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (sessions.length > 0) {
      this.logger.log(
        `Closed the review window on ${sessions.length} session(s)`,
      );
    }
  }

  /**
   * A window that closed with nothing written counts towards the response-rate
   * metric only (spec 4.4), so the row is created as EXPIRED rather than left
   * absent — otherwise "never asked" and "asked and ignored" are
   * indistinguishable.
   */
  private async expireUnwritten(): Promise<void> {
    const { windowDays } = this.settings.get('review');
    const cutoff = new Date(Date.now() - windowDays * 86_400_000);

    const sessions = await this.prisma.bookingSession.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lte: cutoff },
        instructorId: { not: null },
      },
      select: {
        id: true,
        bookingId: true,
        instructorId: true,
        booking: { select: { customerId: true } },
        reviews: { select: { authorType: true } },
      },
      take: 200,
    });

    let created = 0;

    for (const session of sessions) {
      const written = new Set(session.reviews.map((r) => r.authorType));

      const missing = (['CUSTOMER', 'INSTRUCTOR'] as const).filter(
        (side) => !written.has(side),
      );

      for (const authorType of missing) {
        await this.prisma.review.create({
          data: {
            sessionId: session.id,
            bookingId: session.bookingId,
            authorType,
            authorId:
              authorType === 'CUSTOMER'
                ? session.booking.customerId
                : (session.instructorId as string),
            subjectType:
              authorType === 'CUSTOMER'
                ? ('INSTRUCTOR' as const)
                : ('CUSTOMER' as const),
            subjectId:
              authorType === 'CUSTOMER'
                ? (session.instructorId as string)
                : session.booking.customerId,
            direction:
              authorType === 'CUSTOMER'
                ? ('CUSTOMER_TO_INSTRUCTOR' as const)
                : ('INSTRUCTOR_TO_CUSTOMER' as const),
            // Nothing was rated; the row exists only to record the silence.
            overallRating: 0,
            state: 'EXPIRED',
          },
        });
        created += 1;
      }
    }

    if (created > 0) {
      this.logger.log(`Marked ${created} review(s) EXPIRED (window closed)`);
    }
  }

  /**
   * PENDING earnings become PAYABLE once the dispute window closes, which is
   * what makes them eligible for a payout batch (spec 3.7).
   */
  private async releasePayableEarnings(): Promise<void> {
    const now = new Date();

    const { count } = await this.prisma.earning.updateMany({
      where: {
        status: 'PENDING',
        payableFrom: { lte: now },
        // A session that was later cancelled or disputed must not slip
        // through; only a still-completed session pays out.
        session: { status: 'COMPLETED' },
      },
      data: { status: 'PAYABLE' },
    });

    if (count > 0) {
      this.logger.log(`Released ${count} earning(s) to PAYABLE`);
    }
  }
}
