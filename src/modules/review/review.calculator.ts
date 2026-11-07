import type { ReviewPolicy } from '../settings/settings.defaults';

/**
 * Review publishing, aggregation and trust-scoring rules (spec 4). Pure, so
 * the double-blind logic can be tested without a database — getting this
 * wrong leaks one side's review to the other before they have written theirs.
 */

export type ReviewStateName =
  | 'PENDING'
  | 'SUBMITTED'
  | 'PUBLISHED'
  | 'FLAGGED'
  | 'HIDDEN'
  | 'EXPIRED';

export interface ReviewSide {
  state: ReviewStateName;
  submittedAt?: Date | null;
}

export type PublishDecision =
  | { publish: true; reason: 'BOTH_SUBMITTED' | 'WINDOW_CLOSED' }
  | { publish: false; reason: 'WAITING_FOR_COUNTERPARTY' | 'WINDOW_OPEN' | 'NOT_SUBMITTED' };

/**
 * Double-blind rule (spec 4.4): a review becomes visible when both sides have
 * submitted, or when the window closes — whichever comes first. Until then
 * neither side sees the other's.
 */
export function decidePublishing(
  input: {
    own: ReviewSide;
    counterparty: ReviewSide | null;
    sessionCompletedAt: Date;
    now: Date;
  },
  policy: ReviewPolicy,
): PublishDecision {
  if (input.own.state !== 'SUBMITTED') {
    return { publish: false, reason: 'NOT_SUBMITTED' };
  }

  const bothSubmitted =
    input.counterparty !== null &&
    (input.counterparty.state === 'SUBMITTED' ||
      input.counterparty.state === 'PUBLISHED');

  if (bothSubmitted) {
    return { publish: true, reason: 'BOTH_SUBMITTED' };
  }

  const windowClosesAt = new Date(
    input.sessionCompletedAt.getTime() + policy.windowDays * 86_400_000,
  );

  if (input.now >= windowClosesAt) {
    return { publish: true, reason: 'WINDOW_CLOSED' };
  }

  return {
    publish: false,
    reason: input.counterparty ? 'WAITING_FOR_COUNTERPARTY' : 'WINDOW_OPEN',
  };
}

/** Can the author still edit? 24 hours from submission by default. */
export function canEdit(
  review: { state: ReviewStateName; submittedAt?: Date | null },
  now: Date,
  policy: ReviewPolicy,
): boolean {
  if (review.state !== 'SUBMITTED' && review.state !== 'PUBLISHED') {
    return false;
  }
  if (!review.submittedAt) return false;

  return (
    now.getTime() - review.submittedAt.getTime() <
    policy.editLockHours * 3_600_000
  );
}

/** Words and patterns that send a review to moderation (spec 4.5). */
const ABUSE_WORDS = [
  'idiot',
  'stupid',
  'bastard',
  'bitch',
  'fraud',
  'scam',
  'bloody',
];

const PHONE_PATTERN = /(?:\+?\d[\d\s-]{8,}\d)/;
const LINK_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|in|org)\b)/i;

export type FlagReason =
  | 'ABUSIVE_LANGUAGE'
  | 'CONTACT_DETAILS'
  | 'EXTERNAL_LINK'
  | 'LOW_RATING';

/**
 * Automatic flagging. A 1-star review is flagged not because it is wrong but
 * because the spec wants every one reviewed before it affects a livelihood.
 */
export function autoFlagReasons(
  review: { overallRating: number; comment?: string | null },
  policy: ReviewPolicy,
): FlagReason[] {
  const reasons: FlagReason[] = [];
  const comment = (review.comment ?? '').toLowerCase();

  if (ABUSE_WORDS.some((word) => comment.includes(word))) {
    reasons.push('ABUSIVE_LANGUAGE');
  }
  if (PHONE_PATTERN.test(comment)) {
    reasons.push('CONTACT_DETAILS');
  }
  if (LINK_PATTERN.test(comment)) {
    reasons.push('EXTERNAL_LINK');
  }
  if (review.overallRating <= policy.autoFlagAtOrBelow) {
    reasons.push('LOW_RATING');
  }

  return reasons;
}

export interface AggregateInput {
  overallRating: number;
  criteriaScores?: Array<{ slug: string; score: number }>;
}

export interface AggregateResult {
  ratingAvg: number;
  ratingCount: number;
  criteriaAverages: Record<string, number>;
  distribution: Record<string, number>;
}

/**
 * Recomputes an aggregate from the published reviews. Recomputed in full
 * rather than adjusted incrementally: hiding a review has to remove its
 * contribution exactly, and a running average cannot do that reliably.
 */
export function computeAggregate(
  reviews: AggregateInput[],
): AggregateResult {
  const distribution: Record<string, number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };

  if (reviews.length === 0) {
    return {
      ratingAvg: 0,
      ratingCount: 0,
      criteriaAverages: {},
      distribution,
    };
  }

  let total = 0;
  const criteriaTotals = new Map<string, { sum: number; count: number }>();

  for (const review of reviews) {
    total += review.overallRating;

    const bucket = String(Math.min(5, Math.max(1, review.overallRating)));
    distribution[bucket] = (distribution[bucket] ?? 0) + 1;

    for (const score of review.criteriaScores ?? []) {
      const current = criteriaTotals.get(score.slug) ?? { sum: 0, count: 0 };
      criteriaTotals.set(score.slug, {
        sum: current.sum + score.score,
        count: current.count + 1,
      });
    }
  }

  const criteriaAverages: Record<string, number> = {};
  for (const [slug, { sum, count }] of criteriaTotals) {
    criteriaAverages[slug] = round2(sum / count);
  }

  return {
    ratingAvg: round2(total / reviews.length),
    ratingCount: reviews.length,
    criteriaAverages,
    distribution,
  };
}

export type TrustBandName = 'NEW' | 'GOOD' | 'CAUTION' | 'RESTRICTED';

/**
 * Trust score movement from a teacher's review of a customer (spec 4.6).
 * Starts at a neutral 50 and moves by rating: a 5-star visit gains more than
 * a 3-star one loses, so one bad day does not brand a customer.
 */
export function trustDeltaFor(rating: number): number {
  switch (rating) {
    case 5:
      return 6;
    case 4:
      return 3;
    case 3:
      return 0;
    case 2:
      return -6;
    default:
      return -12;
  }
}

export const NEUTRAL_TRUST_SCORE = 50;

export function clampTrustScore(score: number): number {
  return round2(Math.min(100, Math.max(0, score)));
}

/**
 * Band shown to teachers instead of the raw score or the confidential note
 * (spec 4.3). NEW until there is enough history to mean anything.
 */
export function trustBandFor(score: number, reviewCount: number): TrustBandName {
  if (reviewCount < 3) return 'NEW';
  if (score >= 60) return 'GOOD';
  if (score >= 35) return 'CAUTION';
  return 'RESTRICTED';
}

/**
 * Low-rating alert: below the threshold twice inside the window raises an ops
 * alert and mandatory counselling (spec 4.6).
 */
export function needsLowRatingAlert(
  recentRatings: Array<{ rating: number; at: Date }>,
  now: Date,
  policy: ReviewPolicy,
): boolean {
  const since = now.getTime() - policy.lowRatingWindowDays * 86_400_000;

  const lowCount = recentRatings.filter(
    (entry) =>
      entry.at.getTime() >= since && entry.rating < policy.lowRatingThreshold,
  ).length;

  return lowCount >= 2;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
