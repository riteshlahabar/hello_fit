import { DEFAULT_SETTINGS } from '../settings/settings.defaults';
import {
  clashesWithBuffer,
  computeSlots,
  formatMinute,
  mergeBands,
  subtractBands,
} from './slot.calculator';

const policy = DEFAULT_SETTINGS.scheduling;

// A fixed "today" and a date far enough ahead that lead time never interferes.
const NOW = new Date(2026, 10, 1, 9, 0);
const FUTURE = new Date(2026, 10, 10);

const at = (hour: number, minute = 0): number => hour * 60 + minute;

const baseInput = {
  date: FUTURE,
  now: NOW,
  serviceDurationMin: 60,
  availability: [{ startMinute: at(6), endMinute: at(10) }],
  busy: [],
  travelBufferMin: 30,
  sessionsToday: 0,
  dailySessionCap: 4,
};

describe('mergeBands', () => {
  it('merges overlapping bands', () => {
    expect(
      mergeBands([
        { startMinute: 60, endMinute: 120 },
        { startMinute: 100, endMinute: 180 },
      ]),
    ).toEqual([{ startMinute: 60, endMinute: 180 }]);
  });

  it('merges touching bands', () => {
    expect(
      mergeBands([
        { startMinute: 60, endMinute: 120 },
        { startMinute: 120, endMinute: 180 },
      ]),
    ).toEqual([{ startMinute: 60, endMinute: 180 }]);
  });

  it('keeps separate bands apart', () => {
    expect(
      mergeBands([
        { startMinute: 60, endMinute: 120 },
        { startMinute: 200, endMinute: 260 },
      ]),
    ).toHaveLength(2);
  });
});

describe('subtractBands', () => {
  it('splits a band when a block lands in the middle', () => {
    expect(
      subtractBands(
        [{ startMinute: 0, endMinute: 300 }],
        [{ startMinute: 100, endMinute: 200 }],
      ),
    ).toEqual([
      { startMinute: 0, endMinute: 100 },
      { startMinute: 200, endMinute: 300 },
    ]);
  });

  it('removes a band entirely when fully blocked', () => {
    expect(
      subtractBands(
        [{ startMinute: 100, endMinute: 200 }],
        [{ startMinute: 0, endMinute: 300 }],
      ),
    ).toEqual([]);
  });

  it('leaves a band untouched when the block does not overlap', () => {
    expect(
      subtractBands(
        [{ startMinute: 100, endMinute: 200 }],
        [{ startMinute: 300, endMinute: 400 }],
      ),
    ).toEqual([{ startMinute: 100, endMinute: 200 }]);
  });
});

describe('computeSlots', () => {
  it('produces slots on the configured granularity', () => {
    const slots = computeSlots(baseInput, policy);

    expect(slots[0]).toEqual({ fromMinute: at(6), toMinute: at(7) });
    expect(slots[1]).toEqual({ fromMinute: at(6, 30), toMinute: at(7, 30) });
    // 06:00 to 10:00 with 60-min sessions on a 30-min grid: last start 09:00.
    expect(slots.at(-1)).toEqual({ fromMinute: at(9), toMinute: at(10) });
  });

  it('never returns a slot that would end after the availability band', () => {
    const slots = computeSlots(baseInput, policy);

    expect(slots.every((slot) => slot.toMinute <= at(10))).toBe(true);
  });

  it('blocks the travel buffer either side of an existing session', () => {
    const slots = computeSlots(
      {
        ...baseInput,
        busy: [{ startMinute: at(8), endMinute: at(9) }],
      },
      policy,
    );

    // The 07:30 slot would end at 08:30, inside the busy session; and any slot
    // starting before 09:30 collides with the buffer after it.
    expect(
      slots.some((slot) => slot.fromMinute === at(7, 30)),
    ).toBe(false);
    expect(slots.some((slot) => slot.fromMinute === at(6, 30))).toBe(true);
  });

  it('returns nothing when the daily cap is reached', () => {
    expect(
      computeSlots({ ...baseInput, sessionsToday: 4 }, policy),
    ).toEqual([]);
  });

  it('returns nothing on a blocked day such as a holiday or approved leave', () => {
    expect(
      computeSlots({ ...baseInput, isBlockedDay: true }, policy),
    ).toEqual([]);
  });

  it('clips availability to institute working hours', () => {
    const slots = computeSlots(
      {
        ...baseInput,
        availability: [{ startMinute: at(3), endMinute: at(23) }],
      },
      policy,
    );

    expect(slots[0].fromMinute).toBeGreaterThanOrEqual(
      policy.instituteOpenMinute,
    );
    expect(slots.at(-1)!.toMinute).toBeLessThanOrEqual(
      policy.instituteCloseMinute,
    );
  });

  it('honours a date-specific block', () => {
    const slots = computeSlots(
      {
        ...baseInput,
        blockedBands: [{ startMinute: at(6), endMinute: at(8) }],
      },
      policy,
    );

    expect(slots.every((slot) => slot.fromMinute >= at(8))).toBe(true);
  });

  it('opens extra bands added for the date', () => {
    const slots = computeSlots(
      {
        ...baseInput,
        extraBands: [{ startMinute: at(18), endMinute: at(20) }],
      },
      policy,
    );

    expect(slots.some((slot) => slot.fromMinute === at(18))).toBe(true);
  });

  it('enforces the lead time for today', () => {
    const todayAt9 = new Date(2026, 10, 1, 9, 0);
    const slots = computeSlots(
      {
        ...baseInput,
        date: todayAt9,
        now: todayAt9,
        availability: [{ startMinute: at(6), endMinute: at(20) }],
      },
      policy,
    );

    // 09:00 now + 120 minutes lead time means nothing before 11:00.
    expect(slots.every((slot) => slot.fromMinute >= at(11))).toBe(true);
  });

  it('offers nothing for a date already past', () => {
    const slots = computeSlots(
      { ...baseInput, date: new Date(2026, 9, 1), now: NOW },
      policy,
    );

    expect(slots).toEqual([]);
  });

  it('offers nothing when the service is longer than any free band', () => {
    expect(
      computeSlots({ ...baseInput, serviceDurationMin: 600 }, policy),
    ).toEqual([]);
  });
});

describe('clashesWithBuffer', () => {
  it('detects a clash inside the buffer window', () => {
    expect(
      clashesWithBuffer(
        { startMinute: at(9), endMinute: at(10) },
        { startMinute: at(10, 15), endMinute: at(11) },
        30,
      ),
    ).toBe(true);
  });

  it('allows a gap wider than the buffer', () => {
    expect(
      clashesWithBuffer(
        { startMinute: at(9), endMinute: at(10) },
        { startMinute: at(11), endMinute: at(12) },
        30,
      ),
    ).toBe(false);
  });
});

describe('formatMinute', () => {
  it('formats minutes from midnight as HH:mm', () => {
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(390)).toBe('06:30');
    expect(formatMinute(1_439)).toBe('23:59');
  });
});
