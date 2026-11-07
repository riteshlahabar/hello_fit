import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SessionService } from './session.service';
import {
  minutesOfLocalDay,
  todayCalendar,
} from '../../common/dates/calendar';

/**
 * Closes sessions nobody checked out of (spec 3.4: "If neither acts, the
 * system auto-completes 30 minutes after the to-time"), and marks teacher
 * no-shows where check-in never happened.
 *
 * Without this an in-progress session would never produce an earning, and the
 * teacher would be unpaid for work they did.
 */
@Injectable()
export class SessionAutoCompleteService {
  private readonly logger = new Logger(SessionAutoCompleteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly sessions: SessionService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    await this.autoCompleteOverdue();
    await this.flagTeacherNoShows();
  }

  /** IN_PROGRESS past its to-time plus grace becomes COMPLETED. */
  private async autoCompleteOverdue(): Promise<void> {
    const { autoCompleteGraceMin } = this.settings.get('scheduling');
    const now = new Date();
    const today = todayCalendar(now);
    const nowMinutes = minutesOfLocalDay(now);

    const overdue = await this.prisma.bookingSession.findMany({
      where: {
        status: 'IN_PROGRESS',
        deletedAt: null,
        instructorId: { not: null },
        OR: [
          // Earlier days: anything still running is overdue.
          { sessionDate: { lt: today } },
          {
            sessionDate: today,
            toMinute: { lt: nowMinutes - autoCompleteGraceMin },
          },
        ],
      },
      select: {
        id: true,
        bookingId: true,
        status: true,
        serviceId: true,
        sessionValue: true,
        instructorId: true,
      },
      take: 100,
    });

    for (const session of overdue) {
      try {
        await this.sessions.completeSession({
          session,
          instructorId: session.instructorId as string,
          completedAt: now,
          actorType: 'SYSTEM',
          reason: `Auto-completed ${autoCompleteGraceMin} minutes after the scheduled end`,
        });
      } catch (error) {
        this.logger.error(
          `Auto-complete failed for session ${session.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (overdue.length > 0) {
      this.logger.log(`Auto-completed ${overdue.length} session(s)`);
    }
  }

  /**
   * An assigned session whose start time has long passed with no check-in is
   * a teacher no-show: full refund plus goodwill to the customer and a
   * reliability penalty (spec 3.2). The refund itself is raised by the
   * payments module; this marks the state and the audit trail.
   */
  private async flagTeacherNoShows(): Promise<void> {
    const { noShowWaitMin } = this.settings.get('scheduling');
    const now = new Date();
    const today = todayCalendar(now);
    const nowMinutes = minutesOfLocalDay(now);

    const candidates = await this.prisma.bookingSession.findMany({
      where: {
        status: { in: ['ASSIGNED', 'EN_ROUTE'] },
        deletedAt: null,
        checkIn: null,
        OR: [
          { sessionDate: { lt: today } },
          {
            sessionDate: today,
            toMinute: { lt: nowMinutes - noShowWaitMin },
          },
        ],
      },
      select: { id: true, bookingId: true, status: true, instructorId: true },
      take: 100,
    });

    for (const session of candidates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.bookingSession.update({
          where: { id: session.id },
          data: {
            status: 'NO_SHOW_TEACHER',
            cancelReason: 'Teacher did not check in',
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: session.bookingId,
            sessionId: session.id,
            fromStatus: session.status,
            toStatus: 'NO_SHOW_TEACHER',
            actorType: 'SYSTEM',
            actorId: session.instructorId,
            reason: 'No check-in recorded after the session window closed',
          },
        });
      });
    }

    if (candidates.length > 0) {
      this.logger.warn(
        `Flagged ${candidates.length} teacher no-show(s) — refunds pending`,
      );
    }
  }
}
