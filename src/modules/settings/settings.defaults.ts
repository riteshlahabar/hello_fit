/**
 * Every value the spec calls "admin-configurable" lives here as a typed
 * default and is overridden by an AppSetting row. Nothing in the domain code
 * may hard-code these numbers — section 12 of the spec lists most of them as
 * still awaiting client confirmation, so they will change.
 */

/** Cancellation refund slabs (spec 3.5), as percentages of session value. */
export interface RefundSlabs {
  moreThan24hPercent: number;
  between2And24hPercent: number;
  lessThan2hPercent: number;
  afterCheckInPercent: number;
  /** Teacher- or admin-initiated cancellation. */
  providerCancelPercent: number;
  /** Goodwill wallet credit added when the provider cancels or no-shows. */
  providerCancelGoodwill: number;
  /** Charged to the customer on a no-show, as a percentage. */
  customerNoShowChargePercent: number;
}

/** Reschedule policy (spec 3.5). */
export interface ReschedulePolicy {
  freeBeyondHours: number;
  freeRescheduleCountWithin24h: number;
  blockedWithinHours: number;
}

/** Auto-assignment scoring weights (spec 3.3). Must total 100. */
export interface MatchingWeights {
  rating: number;
  distance: number;
  reliability: number;
  preferenceMatch: number;
  loadBalancing: number;
  continuity: number;
}

export interface AssignmentPolicy {
  weights: MatchingWeights;
  /** Minutes a teacher has to accept an offer before it cascades. */
  offerTimeoutMinutes: number;
  /** Failed offers before the session lands in the admin queue. */
  maxCascadeAttempts: number;
  /** Beyond this, distance scores zero. */
  maxDistanceKm: number;
}

export interface SchedulingPolicy {
  /** Minutes blocked either side of a session for travel. */
  defaultTravelBufferMin: number;
  /** Granularity of the slot grid shown to the customer. */
  slotGranularityMin: number;
  /** A slot must start at least this far in the future. */
  minLeadTimeMinutes: number;
  /** How far ahead the customer may book. */
  maxAdvanceDays: number;
  instituteOpenMinute: number;
  instituteCloseMinute: number;
  /** Grace after to-time before a session auto-completes (spec 3.4). */
  autoCompleteGraceMin: number;
  /** How long the teacher waits before a customer no-show may be marked. */
  noShowWaitMin: number;
}

export interface PaymentPolicy {
  /** Unpaid bookings expire and release their slots (spec 3.1). */
  slotHoldMinutes: number;
  taxPercent: number;
  /** Free travel radius; beyond it the distance slabs apply. */
  freeTravelRadiusKm: number;
  travelSlabs: { uptoKm: number; charge: number }[];
}

export interface PayoutPolicy {
  /** Dispute window before an earning becomes payable (spec 3.7). */
  disputeWindowHours: number;
  defaultCommissionPercent: number;
  tdsPercent: number;
  minimumPayoutAmount: number;
  /** 0 = Sunday. The weekly batch job runs on this day. */
  payoutCycleDay: number;
}

export interface ReviewPolicy {
  /** Double-blind publishing window (spec 4.4). */
  windowDays: number;
  /** How long the author may edit after submitting. */
  editLockHours: number;
  /** Ratings at or below this are auto-flagged for moderation. */
  autoFlagAtOrBelow: number;
  /** Two of these inside lowRatingWindowDays raises an ops alert (spec 4.6). */
  lowRatingThreshold: number;
  lowRatingWindowDays: number;
}

export interface HelloFitSettings {
  refundSlabs: RefundSlabs;
  reschedulePolicy: ReschedulePolicy;
  assignment: AssignmentPolicy;
  scheduling: SchedulingPolicy;
  payment: PaymentPolicy;
  payout: PayoutPolicy;
  review: ReviewPolicy;
}

/**
 * Defaults taken from the spec. Where the spec leaves a value open (section
 * 12), the value here is a working assumption flagged for confirmation.
 */
export const DEFAULT_SETTINGS: HelloFitSettings = {
  refundSlabs: {
    moreThan24hPercent: 100,
    between2And24hPercent: 75,
    lessThan2hPercent: 50,
    afterCheckInPercent: 0,
    providerCancelPercent: 100,
    providerCancelGoodwill: 100,
    customerNoShowChargePercent: 100,
  },
  reschedulePolicy: {
    freeBeyondHours: 24,
    freeRescheduleCountWithin24h: 1,
    blockedWithinHours: 2,
  },
  assignment: {
    weights: {
      rating: 25,
      distance: 20,
      reliability: 20,
      preferenceMatch: 15,
      loadBalancing: 10,
      continuity: 10,
    },
    offerTimeoutMinutes: 10,
    maxCascadeAttempts: 3,
    maxDistanceKm: 25,
  },
  scheduling: {
    defaultTravelBufferMin: 30,
    slotGranularityMin: 30,
    minLeadTimeMinutes: 120,
    maxAdvanceDays: 60,
    instituteOpenMinute: 5 * 60,
    instituteCloseMinute: 22 * 60,
    autoCompleteGraceMin: 30,
    noShowWaitMin: 15,
  },
  payment: {
    slotHoldMinutes: 15,
    taxPercent: 18,
    freeTravelRadiusKm: 5,
    travelSlabs: [
      { uptoKm: 10, charge: 50 },
      { uptoKm: 15, charge: 100 },
      { uptoKm: 25, charge: 150 },
    ],
  },
  payout: {
    disputeWindowHours: 48,
    defaultCommissionPercent: 25,
    tdsPercent: 10,
    minimumPayoutAmount: 500,
    payoutCycleDay: 1,
  },
  review: {
    windowDays: 7,
    editLockHours: 24,
    autoFlagAtOrBelow: 1,
    lowRatingThreshold: 3,
    lowRatingWindowDays: 30,
  },
};

export type SettingsKey = keyof HelloFitSettings;
