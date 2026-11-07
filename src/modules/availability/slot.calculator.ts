import type { SchedulingPolicy } from '../settings/settings.defaults';

/**
 * Slot computation (spec 3.1 step 4). Pure arithmetic on minutes-from-midnight
 * so no time-zone conversion can shift a session by an hour.
 *
 * A slot survives only if it clears every one of: the teacher weekly rule, any
 * date override, institute working hours, holidays, the lead time, the daily
 * session cap, and every existing assignment widened by the travel buffer on
 * both sides.
 */

export interface TimeBand {
  startMinute: number;
  endMinute: number;
}

export interface BusyBand extends TimeBand {
  /** Buffer already applied to this band, if any. */
  bufferMin?: number;
}

export interface SlotInput {
  /** Date being searched, used only for the lead-time comparison. */
  date: Date;
  now: Date;
  serviceDurationMin: number;
  /** Weekly availability bands that apply to this date. */
  availability: TimeBand[];
  /** Extra bands opened for this specific date. */
  extraBands?: TimeBand[];
  /** Bands blocked for this specific date. */
  blockedBands?: TimeBand[];
  /** Existing sessions for this teacher on this date. */
  busy: BusyBand[];
  travelBufferMin: number;
  /** Sessions already booked on this date, against the cap. */
  sessionsToday: number;
  dailySessionCap: number;
  /** True when a holiday or approved leave covers the whole date. */
  isBlockedDay?: boolean;
}

export interface Slot {
  fromMinute: number;
  toMinute: number;
}

/** Merges overlapping or touching bands so gap maths stays simple. */
export function mergeBands(bands: TimeBand[]): TimeBand[] {
  if (bands.length === 0) return [];

  const sorted = [...bands].sort((a, b) => a.startMinute - b.startMinute);
  const merged: TimeBand[] = [{ ...sorted[0] }];

  for (const band of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (band.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, band.endMinute);
    } else {
      merged.push({ ...band });
    }
  }

  return merged;
}

/** Removes the blocked bands from the available bands. */
export function subtractBands(
  available: TimeBand[],
  blocked: TimeBand[],
): TimeBand[] {
  if (blocked.length === 0) return available;

  const blockedMerged = mergeBands(blocked);
  const result: TimeBand[] = [];

  for (const band of available) {
    let segments: TimeBand[] = [{ ...band }];

    for (const block of blockedMerged) {
      const next: TimeBand[] = [];

      for (const segment of segments) {
        // No overlap: keep the segment whole.
        if (
          block.endMinute <= segment.startMinute ||
          block.startMinute >= segment.endMinute
        ) {
          next.push(segment);
          continue;
        }

        // Keep whatever lies before and after the block.
        if (block.startMinute > segment.startMinute) {
          next.push({
            startMinute: segment.startMinute,
            endMinute: block.startMinute,
          });
        }
        if (block.endMinute < segment.endMinute) {
          next.push({
            startMinute: block.endMinute,
            endMinute: segment.endMinute,
          });
        }
      }

      segments = next;
    }

    result.push(...segments);
  }

  return result;
}

export function computeSlots(
  input: SlotInput,
  policy: SchedulingPolicy,
): Slot[] {
  if (input.isBlockedDay) return [];
  if (input.sessionsToday >= input.dailySessionCap) return [];
  if (input.serviceDurationMin <= 0) return [];

  // Teacher availability, widened by any date-specific extra bands and
  // clipped to institute working hours.
  const opened = mergeBands([
    ...input.availability,
    ...(input.extraBands ?? []),
  ])
    .map((band) => ({
      startMinute: Math.max(band.startMinute, policy.instituteOpenMinute),
      endMinute: Math.min(band.endMinute, policy.instituteCloseMinute),
    }))
    .filter((band) => band.endMinute > band.startMinute);

  // Existing sessions block their own time plus travel either side, so the
  // teacher is never expected to be in two places at once.
  const busyWithBuffer: TimeBand[] = input.busy.map((band) => {
    const buffer = band.bufferMin ?? input.travelBufferMin;
    return {
      startMinute: band.startMinute - buffer,
      endMinute: band.endMinute + buffer,
    };
  });

  const free = subtractBands(opened, [
    ...busyWithBuffer,
    ...(input.blockedBands ?? []),
  ]);

  // Earliest start allowed by the lead time, expressed in minutes from
  // midnight on the searched date.
  const leadCutoff = startMinuteCutoff(input.date, input.now, policy);

  const slots: Slot[] = [];

  for (const band of free) {
    const firstStart =
      Math.ceil(
        Math.max(band.startMinute, leadCutoff) / policy.slotGranularityMin,
      ) * policy.slotGranularityMin;

    for (
      let start = firstStart;
      start + input.serviceDurationMin <= band.endMinute;
      start += policy.slotGranularityMin
    ) {
      slots.push({
        fromMinute: start,
        toMinute: start + input.serviceDurationMin,
      });
    }
  }

  return slots;
}

/**
 * Minutes-from-midnight before which a slot is too soon to book. Returns a
 * negative number for future dates (no restriction) and a very large number
 * for past dates (nothing bookable).
 */
function startMinuteCutoff(
  date: Date,
  now: Date,
  policy: SchedulingPolicy,
): number {
  // Compared as calendar days: the searched date arrives as UTC midnight
  // from a date column, while "now" is an instant in local time.
  const dayStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const nowDayStart = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  if (dayStart > nowDayStart) return Number.NEGATIVE_INFINITY;
  if (dayStart < nowDayStart) return Number.POSITIVE_INFINITY;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes + policy.minLeadTimeMinutes;
}

/** True when two bands overlap once the travel buffer is applied. */
export function clashesWithBuffer(
  a: TimeBand,
  b: TimeBand,
  bufferMin: number,
): boolean {
  return (
    a.startMinute - bufferMin < b.endMinute &&
    b.startMinute - bufferMin < a.endMinute
  );
}

export const formatMinute = (minute: number): string =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
