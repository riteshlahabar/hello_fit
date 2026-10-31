import { DEFAULT_SETTINGS } from '../settings/settings.defaults';
import {
  rankCandidates,
  rejectionReason,
  scoreCandidate,
  type Candidate,
} from './matching.calculator';

const policy = DEFAULT_SETTINGS.assignment;

const eligible: Candidate = {
  instructorId: 'i1',
  isActive: true,
  kycVerified: true,
  offersService: true,
  servesArea: true,
  availabilityCovers: true,
  hasClash: false,
  onLeave: false,
  sessionsToday: 0,
  dailySessionCap: 4,
  distanceKm: 3,
  travelRadiusKm: 15,
  ratingAvg: 4.5,
  ratingCount: 40,
  reliabilityScore: 90,
  languages: ['en', 'hi'],
  gender: 'FEMALE',
  pastSessionsWithCustomer: 0,
};

describe('rejectionReason — hard filters', () => {
  it('accepts a fully eligible teacher', () => {
    expect(rejectionReason(eligible, policy)).toBeNull();
  });

  it.each([
    ['INACTIVE', { isActive: false }],
    ['KYC_NOT_VERIFIED', { kycVerified: false }],
    ['SERVICE_NOT_OFFERED', { offersService: false }],
    ['AREA_NOT_SERVED', { servesArea: false }],
    ['NO_AVAILABILITY', { availabilityCovers: false }],
    ['CLASH', { hasClash: true }],
    ['ON_LEAVE', { onLeave: true }],
    ['DAILY_CAP_REACHED', { sessionsToday: 4 }],
  ])('rejects with %s', (reason, override) => {
    expect(rejectionReason({ ...eligible, ...override }, policy)).toBe(reason);
  });

  it('rejects beyond the teacher own travel radius', () => {
    expect(
      rejectionReason({ ...eligible, distanceKm: 20, travelRadiusKm: 15 }, policy),
    ).toBe('OUTSIDE_TRAVEL_RADIUS');
  });

  it('rejects beyond the policy maximum even if the teacher would travel further', () => {
    expect(
      rejectionReason(
        { ...eligible, distanceKm: 30, travelRadiusKm: 50 },
        policy,
      ),
    ).toBe('OUTSIDE_TRAVEL_RADIUS');
  });
});

describe('scoreCandidate', () => {
  const context = { maxSessionsToday: 4 };

  it('never exceeds the total of the configured weights', () => {
    const perfect: Candidate = {
      ...eligible,
      ratingAvg: 5,
      reliabilityScore: 100,
      distanceKm: 0,
      sessionsToday: 0,
      pastSessionsWithCustomer: 10,
    };

    const total = Object.values(policy.weights).reduce((a, b) => a + b, 0);

    expect(scoreCandidate(perfect, context, policy).score).toBeLessThanOrEqual(
      total,
    );
  });

  it('scores a closer teacher above an identical distant one', () => {
    const near = scoreCandidate({ ...eligible, distanceKm: 1 }, context, policy);
    const far = scoreCandidate({ ...eligible, distanceKm: 20 }, context, policy);

    expect(near.score).toBeGreaterThan(far.score);
  });

  it('scores a higher-rated teacher above a lower-rated one', () => {
    const good = scoreCandidate({ ...eligible, ratingAvg: 5 }, context, policy);
    const poor = scoreCandidate({ ...eligible, ratingAvg: 2 }, context, policy);

    expect(good.score).toBeGreaterThan(poor.score);
  });

  it('gives a brand-new teacher a neutral rating rather than zero', () => {
    const fresh = scoreCandidate(
      { ...eligible, ratingCount: 0, ratingAvg: 0 },
      context,
      policy,
    );

    expect(fresh.components.rating).toBeGreaterThan(0);
  });

  it('rewards continuity with the same customer', () => {
    const known = scoreCandidate(
      { ...eligible, pastSessionsWithCustomer: 5 },
      context,
      policy,
    );
    const unknown = scoreCandidate(eligible, context, policy);

    expect(known.score).toBeGreaterThan(unknown.score);
  });

  it('prefers the less loaded teacher', () => {
    const light = scoreCandidate({ ...eligible, sessionsToday: 0 }, context, policy);
    const heavy = scoreCandidate({ ...eligible, sessionsToday: 3 }, context, policy);

    expect(light.score).toBeGreaterThan(heavy.score);
  });

  it('penalises a missed language preference', () => {
    const matched = scoreCandidate(
      eligible,
      { ...context, preferredLanguage: 'hi' },
      policy,
    );
    const missed = scoreCandidate(
      eligible,
      { ...context, preferredLanguage: 'ta' },
      policy,
    );

    expect(matched.score).toBeGreaterThan(missed.score);
  });

  it('does not penalise when the customer stated no preference', () => {
    const noPreference = scoreCandidate(eligible, context, policy);

    expect(noPreference.components.preferenceMatch).toBe(
      policy.weights.preferenceMatch,
    );
  });
});

describe('rankCandidates', () => {
  it('separates eligible from rejected and explains each rejection', () => {
    const { ranked, rejected } = rankCandidates(
      [
        eligible,
        { ...eligible, instructorId: 'i2', onLeave: true },
        { ...eligible, instructorId: 'i3', kycVerified: false },
      ],
      {},
      policy,
    );

    expect(ranked).toHaveLength(1);
    expect(rejected).toEqual([
      { instructorId: 'i2', reason: 'ON_LEAVE' },
      { instructorId: 'i3', reason: 'KYC_NOT_VERIFIED' },
    ]);
  });

  it('orders best first', () => {
    const { ranked } = rankCandidates(
      [
        { ...eligible, instructorId: 'weak', ratingAvg: 2, distanceKm: 20 },
        { ...eligible, instructorId: 'strong', ratingAvg: 5, distanceKm: 1 },
      ],
      {},
      policy,
    );

    expect(ranked[0].instructorId).toBe('strong');
  });

  it('breaks ties deterministically so a cascade can be replayed', () => {
    const first = rankCandidates(
      [
        { ...eligible, instructorId: 'bbb' },
        { ...eligible, instructorId: 'aaa' },
      ],
      {},
      policy,
    );
    const second = rankCandidates(
      [
        { ...eligible, instructorId: 'aaa' },
        { ...eligible, instructorId: 'bbb' },
      ],
      {},
      policy,
    );

    expect(first.ranked.map((r) => r.instructorId)).toEqual(['aaa', 'bbb']);
    expect(second.ranked.map((r) => r.instructorId)).toEqual(['aaa', 'bbb']);
  });

  it('returns nothing rankable when every candidate fails a filter', () => {
    const { ranked } = rankCandidates(
      [{ ...eligible, hasClash: true }],
      {},
      policy,
    );

    expect(ranked).toEqual([]);
  });
});
