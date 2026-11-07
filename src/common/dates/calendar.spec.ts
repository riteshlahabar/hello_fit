import {
  addCalendarDays,
  calendarDayOf,
  calendarDaysBetween,
  calendarWeekday,
  formatCalendarDate,
  parseCalendarDate,
  sessionStartsAt,
} from './calendar';

describe('parseCalendarDate', () => {
  it('keeps the calendar day a client sent, with no timezone shift', () => {
    // The regression this file exists for: in IST this used to become the
    // 30th, so every session was stored a day early.
    expect(formatCalendarDate(parseCalendarDate('2026-10-31'))).toBe(
      '2026-10-31',
    );
  });

  it('normalises to UTC midnight, which is what a date column round-trips', () => {
    const parsed = parseCalendarDate('2026-10-31');

    expect(parsed.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('accepts a full ISO timestamp and keeps its UTC day', () => {
    expect(formatCalendarDate(parseCalendarDate('2026-10-31T23:45:00Z'))).toBe(
      '2026-10-31',
    );
  });

  it('rejects nonsense rather than silently returning Invalid Date', () => {
    expect(() => parseCalendarDate('not-a-date')).toThrow(
      'Invalid calendar date',
    );
  });
});

describe('calendarDayOf', () => {
  it('reads the UTC day of a value that came from a date column', () => {
    // Postgres hands a `date` back as UTC midnight.
    const fromDb = new Date('2026-11-03T00:00:00.000Z');

    expect(formatCalendarDate(calendarDayOf(fromDb))).toBe('2026-11-03');
  });

  it('is idempotent', () => {
    const once = calendarDayOf(new Date('2026-11-03T00:00:00.000Z'));

    expect(calendarDayOf(once).getTime()).toBe(once.getTime());
  });
});

describe('calendarWeekday', () => {
  it('reports the weekday of the calendar day, not of local time', () => {
    // 1 November 2026 is a Sunday.
    expect(calendarWeekday(parseCalendarDate('2026-11-01'))).toBe(0);
    expect(calendarWeekday(parseCalendarDate('2026-11-02'))).toBe(1);
    expect(calendarWeekday(parseCalendarDate('2026-11-07'))).toBe(6);
  });
});

describe('addCalendarDays', () => {
  it('walks forward without drifting off midnight', () => {
    const start = parseCalendarDate('2026-11-01');

    expect(formatCalendarDate(addCalendarDays(start, 5))).toBe('2026-11-06');
    expect(addCalendarDays(start, 5).toISOString()).toContain('T00:00:00.000Z');
  });

  it('crosses a month boundary', () => {
    expect(
      formatCalendarDate(addCalendarDays(parseCalendarDate('2026-10-30'), 3)),
    ).toBe('2026-11-02');
  });

  it('goes backwards', () => {
    expect(
      formatCalendarDate(addCalendarDays(parseCalendarDate('2026-11-02'), -3)),
    ).toBe('2026-10-30');
  });
});

describe('calendarDaysBetween', () => {
  it('counts whole days', () => {
    expect(
      calendarDaysBetween(
        parseCalendarDate('2026-11-01'),
        parseCalendarDate('2026-11-08'),
      ),
    ).toBe(7);
  });

  it('is negative for a past date', () => {
    expect(
      calendarDaysBetween(
        parseCalendarDate('2026-11-08'),
        parseCalendarDate('2026-11-01'),
      ),
    ).toBe(-7);
  });
});

describe('sessionStartsAt', () => {
  it('places the start at local wall-clock time on the calendar day', () => {
    const start = sessionStartsAt(parseCalendarDate('2026-11-03'), 7 * 60 + 30);

    // Asserted in local terms, because 07:30 means 07:30 where the teacher is.
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(3);
    expect(start.getHours()).toBe(7);
    expect(start.getMinutes()).toBe(30);
  });

  it('handles midnight and the last minute of the day', () => {
    const day = parseCalendarDate('2026-11-03');

    expect(sessionStartsAt(day, 0).getHours()).toBe(0);
    expect(sessionStartsAt(day, 23 * 60 + 59).getHours()).toBe(23);
    expect(sessionStartsAt(day, 23 * 60 + 59).getDate()).toBe(3);
  });

  it('gives a refund window measured from the real instant', () => {
    const day = parseCalendarDate('2026-11-03');
    const start = sessionStartsAt(day, 20 * 60);

    // Three hours before the session, in local terms.
    const now = new Date(start.getTime() - 3 * 3_600_000);
    const hoursUntil = (start.getTime() - now.getTime()) / 3_600_000;

    expect(hoursUntil).toBe(3);
  });
});
