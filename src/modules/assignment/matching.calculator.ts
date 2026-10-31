import type { AssignmentPolicy } from '../settings/settings.defaults';

/**
 * Teacher matching (spec 3.3): hard filters first, then a weighted score.
 * Pure, so the hard filters and the weighting can be tested without a
 * database — the spec requires unit tests on this logic.
 */

export interface Candidate {
  instructorId: string;
  isActive: boolean;
  kycVerified: boolean;
  offersService: boolean;
  servesArea: boolean;
  availabilityCovers: boolean;
  hasClash: boolean;
  onLeave: boolean;
  sessionsToday: number;
  dailySessionCap: number;
  distanceKm: number;
  travelRadiusKm: number;
  ratingAvg: number;
  ratingCount: number;
  reliabilityScore: number;
  languages: string[];
  gender: string;
  /** Sessions already taught for this customer, for the continuity score. */
  pastSessionsWithCustomer: number;
}

export interface MatchContext {
  preferredLanguage?: string;
  preferredGender?: string;
  /** Highest sessionsToday across candidates, for load balancing. */
  maxSessionsToday: number;
}

export type RejectionReason =
  | 'INACTIVE'
  | 'KYC_NOT_VERIFIED'
  | 'SERVICE_NOT_OFFERED'
  | 'AREA_NOT_SERVED'
  | 'OUTSIDE_TRAVEL_RADIUS'
  | 'NO_AVAILABILITY'
  | 'CLASH'
  | 'ON_LEAVE'
  | 'DAILY_CAP_REACHED';

export interface ScoredCandidate {
  instructorId: string;
  score: number;
  components: Record<keyof AssignmentPolicy['weights'], number>;
}

/**
 * Hard filters — all must pass. Returns the reason so the admin assignment
 * queue can explain why nobody matched, which is the common support question.
 */
export function rejectionReason(
  candidate: Candidate,
  policy: AssignmentPolicy,
): RejectionReason | null {
  if (!candidate.isActive) return 'INACTIVE';
  if (!candidate.kycVerified) return 'KYC_NOT_VERIFIED';
  if (!candidate.offersService) return 'SERVICE_NOT_OFFERED';
  if (!candidate.servesArea) return 'AREA_NOT_SERVED';
  if (
    candidate.distanceKm > candidate.travelRadiusKm ||
    candidate.distanceKm > policy.maxDistanceKm
  ) {
    return 'OUTSIDE_TRAVEL_RADIUS';
  }
  if (!candidate.availabilityCovers) return 'NO_AVAILABILITY';
  if (candidate.hasClash) return 'CLASH';
  if (candidate.onLeave) return 'ON_LEAVE';
  if (candidate.sessionsToday >= candidate.dailySessionCap) {
    return 'DAILY_CAP_REACHED';
  }
  return null;
}

/**
 * Weighted score out of 100. Each component is normalised to 0..1 and then
 * multiplied by its configured weight, so changing the weights in admin
 * changes the ranking without touching this code.
 */
export function scoreCandidate(
  candidate: Candidate,
  context: MatchContext,
  policy: AssignmentPolicy,
): ScoredCandidate {
  const w = policy.weights;

  // A teacher with no ratings yet scores neutrally rather than zero, or new
  // teachers would never win an offer.
  const ratingNorm =
    candidate.ratingCount === 0 ? 0.6 : clamp01(candidate.ratingAvg / 5);

  // Closer is better; at or beyond the policy maximum this contributes zero.
  const distanceNorm = clamp01(
    1 - candidate.distanceKm / Math.max(policy.maxDistanceKm, 1),
  );

  const reliabilityNorm = clamp01(candidate.reliabilityScore / 100);

  // Language and gender preference are averaged; an unstated preference
  // counts as satisfied so it neither helps nor penalises.
  const languageOk = context.preferredLanguage
    ? candidate.languages.includes(context.preferredLanguage)
    : true;
  const genderOk = context.preferredGender
    ? candidate.gender === context.preferredGender
    : true;
  const preferenceNorm = ((languageOk ? 1 : 0) + (genderOk ? 1 : 0)) / 2;

  // Fewer sessions today scores higher, spreading the day's load.
  const loadNorm =
    context.maxSessionsToday <= 0
      ? 1
      : clamp01(1 - candidate.sessionsToday / context.maxSessionsToday);

  // Continuity saturates at 5 past sessions — beyond that it is just "known".
  const continuityNorm = clamp01(candidate.pastSessionsWithCustomer / 5);

  const components = {
    rating: ratingNorm * w.rating,
    distance: distanceNorm * w.distance,
    reliability: reliabilityNorm * w.reliability,
    preferenceMatch: preferenceNorm * w.preferenceMatch,
    loadBalancing: loadNorm * w.loadBalancing,
    continuity: continuityNorm * w.continuity,
  };

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    instructorId: candidate.instructorId,
    score: Math.round(score * 100) / 100,
    components,
  };
}

/**
 * Filters then ranks. Ties break on instructorId so the cascade order is
 * deterministic and an offer sequence can be reproduced from the audit log.
 */
export function rankCandidates(
  candidates: Candidate[],
  context: Omit<MatchContext, 'maxSessionsToday'>,
  policy: AssignmentPolicy,
): { ranked: ScoredCandidate[]; rejected: Array<{ instructorId: string; reason: RejectionReason }> } {
  const eligible: Candidate[] = [];
  const rejected: Array<{ instructorId: string; reason: RejectionReason }> = [];

  for (const candidate of candidates) {
    const reason = rejectionReason(candidate, policy);
    if (reason) {
      rejected.push({ instructorId: candidate.instructorId, reason });
    } else {
      eligible.push(candidate);
    }
  }

  const maxSessionsToday = eligible.reduce(
    (max, c) => Math.max(max, c.sessionsToday),
    0,
  );

  const ranked = eligible
    .map((candidate) =>
      scoreCandidate(candidate, { ...context, maxSessionsToday }, policy),
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.instructorId.localeCompare(b.instructorId),
    );

  return { ranked, rejected };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
