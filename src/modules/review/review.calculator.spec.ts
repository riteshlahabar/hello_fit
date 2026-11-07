import { DEFAULT_SETTINGS } from '../settings/settings.defaults';
import {
  autoFlagReasons,
  canEdit,
  clampTrustScore,
  computeAggregate,
  decidePublishing,
  needsLowRatingAlert,
  trustBandFor,
  trustDeltaFor,
} from './review.calculator';

const policy = DEFAULT_SETTINGS.review;

const COMPLETED = new Date('2026-11-01T10:00:00Z');
const at = (hours: number) =>
  new Date(COMPLETED.getTime() + hours * 3_600_000);

describe('decidePublishing — the double-blind rule', () => {
  it('holds a submitted review while the counter-party has not written theirs', () => {
    const decision = decidePublishing(
      {
        own: { state: 'SUBMITTED', submittedAt: at(1) },
        counterparty: { state: 'PENDING' },
        sessionCompletedAt: COMPLETED,
        now: at(2),
      },
      policy,
    );

    expect(decision).toEqual({
      publish: false,
      reason: 'WAITING_FOR_COUNTERPARTY',
    });
  });

  it('publishes as soon as both sides have submitted', () => {
    const decision = decidePublishing(
      {
        own: { state: 'SUBMITTED', submittedAt: at(1) },
        counterparty: { state: 'SUBMITTED', submittedAt: at(2) },
        sessionCompletedAt: COMPLETED,
        now: at(3),
      },
      policy,
    );

    expect(decision).toEqual({ publish: true, reason: 'BOTH_SUBMITTED' });
  });

  it('treats an already-published counter-party as submitted', () => {
    const decision = decidePublishing(
      {
        own: { state: 'SUBMITTED', submittedAt: at(1) },
        counterparty: { state: 'PUBLISHED' },
        sessionCompletedAt: COMPLETED,
        now: at(3),
      },
      policy,
    );

    expect(decision.publish).toBe(true);
  });

  it('publishes when the 7-day window closes, even if only one side wrote', () => {
    const decision = decidePublishing(
      {
        own: { state: 'SUBMITTED', submittedAt: at(1) },
        counterparty: null,
        sessionCompletedAt: COMPLETED,
        now: at(7 * 24),
      },
      policy,
    );

    expect(decision).toEqual({ publish: true, reason: 'WINDOW_CLOSED' });
  });

  it('keeps holding one minute before the window closes', () => {
    const decision = decidePublishing(
      {
        own: { state: 'SUBMITTED', submittedAt: at(1) },
        counterparty: null,
        sessionCompletedAt: COMPLETED,
        now: new Date(at(7 * 24).getTime() - 60_000),
      },
      policy,
    );

    expect(decision.publish).toBe(false);
  });

  it('never publishes a review that was not submitted', () => {
    const decision = decidePublishing(
      {
        own: { state: 'PENDING' },
        counterparty: { state: 'SUBMITTED', submittedAt: at(1) },
        sessionCompletedAt: COMPLETED,
        now: at(8 * 24),
      },
      policy,
    );

    expect(decision).toEqual({ publish: false, reason: 'NOT_SUBMITTED' });
  });

  it('never publishes a hidden review, even past the window', () => {
    const decision = decidePublishing(
      {
        own: { state: 'HIDDEN', submittedAt: at(1) },
        counterparty: { state: 'SUBMITTED' },
        sessionCompletedAt: COMPLETED,
        now: at(30 * 24),
      },
      policy,
    );

    expect(decision.publish).toBe(false);
  });
});

describe('canEdit', () => {
  it('allows editing inside the 24-hour lock', () => {
    expect(
      canEdit({ state: 'SUBMITTED', submittedAt: at(1) }, at(10), policy),
    ).toBe(true);
  });

  it('refuses after 24 hours', () => {
    expect(
      canEdit({ state: 'SUBMITTED', submittedAt: at(1) }, at(26), policy),
    ).toBe(false);
  });

  it('refuses for a hidden review', () => {
    expect(
      canEdit({ state: 'HIDDEN', submittedAt: at(1) }, at(2), policy),
    ).toBe(false);
  });

  it('refuses when nothing was submitted', () => {
    expect(canEdit({ state: 'PENDING' }, at(2), policy)).toBe(false);
  });
});

describe('autoFlagReasons', () => {
  it('passes an ordinary positive review', () => {
    expect(
      autoFlagReasons({ overallRating: 5, comment: 'Calm and punctual.' }, policy),
    ).toEqual([]);
  });

  it('flags abusive language', () => {
    expect(
      autoFlagReasons({ overallRating: 4, comment: 'What a fraud' }, policy),
    ).toContain('ABUSIVE_LANGUAGE');
  });

  it('flags a phone number, which is how people route around the platform', () => {
    expect(
      autoFlagReasons(
        { overallRating: 5, comment: 'Book me direct on 98765 43210' },
        policy,
      ),
    ).toContain('CONTACT_DETAILS');
  });

  it('flags an external link', () => {
    expect(
      autoFlagReasons(
        { overallRating: 5, comment: 'see myyoga.com for cheaper' },
        policy,
      ),
    ).toContain('EXTERNAL_LINK');
  });

  it('flags every 1-star review for a human to read', () => {
    expect(
      autoFlagReasons({ overallRating: 1, comment: 'Did not suit me' }, policy),
    ).toContain('LOW_RATING');
  });

  it('does not flag a 2-star review by rating alone', () => {
    expect(
      autoFlagReasons({ overallRating: 2, comment: 'Average' }, policy),
    ).toEqual([]);
  });

  it('handles a missing comment', () => {
    expect(autoFlagReasons({ overallRating: 4 }, policy)).toEqual([]);
  });
});

describe('computeAggregate', () => {
  it('returns a zeroed aggregate for no reviews', () => {
    const result = computeAggregate([]);

    expect(result).toMatchObject({ ratingAvg: 0, ratingCount: 0 });
    expect(result.distribution).toEqual({
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    });
  });

  it('averages the overall rating', () => {
    const result = computeAggregate([
      { overallRating: 5 },
      { overallRating: 4 },
      { overallRating: 3 },
    ]);

    expect(result.ratingAvg).toBe(4);
    expect(result.ratingCount).toBe(3);
  });

  it('rounds to two decimals rather than carrying float noise', () => {
    const result = computeAggregate([
      { overallRating: 5 },
      { overallRating: 4 },
      { overallRating: 4 },
    ]);

    expect(result.ratingAvg).toBe(4.33);
  });

  it('builds the star distribution', () => {
    const result = computeAggregate([
      { overallRating: 5 },
      { overallRating: 5 },
      { overallRating: 2 },
    ]);

    expect(result.distribution['5']).toBe(2);
    expect(result.distribution['2']).toBe(1);
    expect(result.distribution['4']).toBe(0);
  });

  it('averages each criterion independently', () => {
    const result = computeAggregate([
      {
        overallRating: 5,
        criteriaScores: [
          { slug: 'punctuality', score: 5 },
          { slug: 'knowledge', score: 4 },
        ],
      },
      {
        overallRating: 4,
        criteriaScores: [
          { slug: 'punctuality', score: 3 },
          { slug: 'knowledge', score: 4 },
        ],
      },
    ]);

    expect(result.criteriaAverages).toEqual({
      punctuality: 4,
      knowledge: 4,
    });
  });

  it('copes with a criterion present on only some reviews', () => {
    const result = computeAggregate([
      { overallRating: 5, criteriaScores: [{ slug: 'cleanliness', score: 5 }] },
      { overallRating: 3 },
    ]);

    expect(result.criteriaAverages.cleanliness).toBe(5);
    expect(result.ratingCount).toBe(2);
  });
});

describe('trust scoring', () => {
  it('rewards a good visit and penalises a bad one asymmetrically', () => {
    expect(trustDeltaFor(5)).toBeGreaterThan(0);
    expect(trustDeltaFor(3)).toBe(0);
    expect(trustDeltaFor(1)).toBeLessThan(trustDeltaFor(2));
  });

  it('clamps the score to 0..100', () => {
    expect(clampTrustScore(150)).toBe(100);
    expect(clampTrustScore(-20)).toBe(0);
    expect(clampTrustScore(56.789)).toBe(56.79);
  });

  it('shows NEW until there is enough history to mean anything', () => {
    expect(trustBandFor(100, 0)).toBe('NEW');
    expect(trustBandFor(10, 2)).toBe('NEW');
  });

  it('bands an established customer by score', () => {
    expect(trustBandFor(80, 10)).toBe('GOOD');
    expect(trustBandFor(45, 10)).toBe('CAUTION');
    expect(trustBandFor(20, 10)).toBe('RESTRICTED');
  });

  it('puts the band boundaries where the thresholds say', () => {
    expect(trustBandFor(60, 5)).toBe('GOOD');
    expect(trustBandFor(59.99, 5)).toBe('CAUTION');
    expect(trustBandFor(35, 5)).toBe('CAUTION');
    expect(trustBandFor(34.99, 5)).toBe('RESTRICTED');
  });
});

describe('needsLowRatingAlert', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 86_400_000);

  it('alerts on two low ratings inside the window', () => {
    expect(
      needsLowRatingAlert(
        [
          { rating: 2, at: daysAgo(3) },
          { rating: 1, at: daysAgo(20) },
        ],
        now,
        policy,
      ),
    ).toBe(true);
  });

  it('does not alert on one low rating', () => {
    expect(
      needsLowRatingAlert([{ rating: 2, at: daysAgo(3) }], now, policy),
    ).toBe(false);
  });

  it('ignores low ratings older than the window', () => {
    expect(
      needsLowRatingAlert(
        [
          { rating: 2, at: daysAgo(3) },
          { rating: 1, at: daysAgo(90) },
        ],
        now,
        policy,
      ),
    ).toBe(false);
  });

  it('does not count ratings at or above the threshold', () => {
    expect(
      needsLowRatingAlert(
        [
          { rating: 3, at: daysAgo(1) },
          { rating: 4, at: daysAgo(2) },
        ],
        now,
        policy,
      ),
    ).toBe(false);
  });
});
