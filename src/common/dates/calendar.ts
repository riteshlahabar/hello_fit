/**
 * Calendar-date handling for session dates.
 *
 * A session date is a *calendar day* ("3 November"), not an instant. The time
 * of day is carried separately as minutes from midnight in institute-local
 * wall-clock time. Mixing the two is how sessions end up on the wrong day:
 *
 *   new Date('2026-10-31')            // 2026-10-31T00:00:00Z
 *   new Date(y, m, d)                 // local midnight = 2026-10-30T18:30Z in IST
 *   stored in a `date` column         // truncated in UTC → 2026-10-30  ✗
 *
 * So every calendar date is normalised to **UTC midnight**, which is what a
 * Postgres `date` column round-trips unchanged, and the wall-clock instant is
 * derived only when one is actually needed (refund windows, lateness).
 */

/** Parses 'YYYY-MM-DD' (or a Date) to UTC midnight of that calendar day. */
export function parseCalendarDate(value: string | Date): Date {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (match) {
      return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      );
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid calendar date: ${value}`);
    }
    return calendarDayOf(parsed);
  }

  return calendarDayOf(value);
}

/**
 * UTC midnight of the day a Date falls on, read in UTC. Use for values that
 * came out of a `date` column — Postgres hands them back as UTC midnight, so
 * their UTC parts are the true calendar date.
 */
export function calendarDayOf(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * The calendar day it is *right now* in institute-local time. Local parts on
 * purpose: at 01:00 IST the local day is already tomorrow in UTC terms, and
 * the teacher's "today" must follow the local day.
 */
export function todayCalendar(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function calendarWeekday(date: Date): number {
  return date.getUTCDay();
}

/** Adds whole days to a calendar date, staying on UTC midnight. */
export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Whole days between two calendar dates (b − a). */
export function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round(
    (calendarDayOf(b).getTime() - calendarDayOf(a).getTime()) / 86_400_000,
  );
}

/** 'YYYY-MM-DD' for API responses and logs. */
export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The real instant a session starts: its calendar date at institute-local
 * wall-clock time. This is what refund windows, lateness and lead time are
 * measured against — a slot labelled 07:00 means 07:00 where the teacher is,
 * not 07:00 UTC.
 */
export function sessionStartsAt(sessionDate: Date, fromMinute: number): Date {
  const day = calendarDayOf(sessionDate);

  const localMidnight = new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );

  return new Date(localMidnight.getTime() + fromMinute * 60_000);
}

/** Minutes from local midnight for an instant — the inverse of the above. */
export function minutesOfLocalDay(instant: Date = new Date()): number {
  return instant.getHours() * 60 + instant.getMinutes();
}
