import type { PaymentPolicy } from '../settings/settings.defaults';

/**
 * Pure pricing arithmetic (spec 3.1 step 9):
 *   service price x sessions + add-ons + travel - discount - wallet + tax
 *
 * Money is handled in paise as integers throughout, then converted once at
 * the edge. Floating-point rupees drift: 0.1 + 0.2 !== 0.3, and a few paise
 * of drift per session becomes a reconciliation mismatch at month end.
 */

export interface AddonLine {
  addonId: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteInput {
  /** Per-session price: the instructor rate card overrides the service base. */
  unitPrice: number;
  sessionCount: number;
  addons: AddonLine[];
  /** Straight-line distance from the teacher base to the address. */
  distanceKm?: number;
  /** Absolute discount from a coupon or membership benefit. */
  discount?: number;
  /** Wallet amount the customer chose to apply. */
  walletApplied?: number;
  /** Membership bookings consume quota instead of charging. */
  isMembershipCovered?: boolean;
}

export interface QuoteBreakup {
  unitPrice: number;
  sessionCount: number;
  grossAmount: number;
  addonAmount: number;
  travelCharge: number;
  discount: number;
  taxableValue: number;
  tax: number;
  walletApplied: number;
  payable: number;
  /** Per-session value, used to create the earning row on completion. */
  sessionValue: number;
}

const toPaise = (rupees: number): number => Math.round(rupees * 100);
const toRupees = (paise: number): number => Math.round(paise) / 100;

/**
 * Travel charge from the distance slabs. Inside the free radius it is zero;
 * beyond the last slab the last slab applies rather than refusing the booking
 * (the hard limit is enforced by the matching engine, not pricing).
 */
export function travelChargeFor(
  distanceKm: number | undefined,
  policy: PaymentPolicy,
): number {
  if (distanceKm === undefined || distanceKm <= policy.freeTravelRadiusKm) {
    return 0;
  }

  const slabs = [...policy.travelSlabs].sort((a, b) => a.uptoKm - b.uptoKm);
  const match = slabs.find((slab) => distanceKm <= slab.uptoKm);

  return match ? match.charge : (slabs.at(-1)?.charge ?? 0);
}

export function quote(input: QuoteInput, policy: PaymentPolicy): QuoteBreakup {
  if (input.sessionCount < 1) {
    throw new Error('sessionCount must be at least 1');
  }
  if (input.unitPrice < 0) {
    throw new Error('unitPrice cannot be negative');
  }

  const unitPaise = toPaise(input.unitPrice);
  const grossPaise = input.isMembershipCovered
    ? 0
    : unitPaise * input.sessionCount;

  const addonPaise = input.addons.reduce((sum, line) => {
    if (line.quantity < 0 || line.unitPrice < 0) {
      throw new Error('add-on quantity and price cannot be negative');
    }
    return sum + toPaise(line.unitPrice) * line.quantity;
  }, 0);

  // Travel is charged per visit, not per booking.
  const travelPaise =
    toPaise(travelChargeFor(input.distanceKm, policy)) * input.sessionCount;

  // A discount can never exceed what is being charged.
  const discountPaise = Math.min(
    toPaise(input.discount ?? 0),
    grossPaise + addonPaise + travelPaise,
  );

  const taxablePaise = grossPaise + addonPaise + travelPaise - discountPaise;
  const taxPaise = Math.round((taxablePaise * policy.taxPercent) / 100);
  const totalPaise = taxablePaise + taxPaise;

  // Wallet applies after tax and cannot exceed the bill.
  const walletPaise = Math.min(toPaise(input.walletApplied ?? 0), totalPaise);
  const payablePaise = totalPaise - walletPaise;

  return {
    unitPrice: input.unitPrice,
    sessionCount: input.sessionCount,
    grossAmount: toRupees(grossPaise),
    addonAmount: toRupees(addonPaise),
    travelCharge: toRupees(travelPaise),
    discount: toRupees(discountPaise),
    taxableValue: toRupees(taxablePaise),
    tax: toRupees(taxPaise),
    walletApplied: toRupees(walletPaise),
    payable: toRupees(payablePaise),
    // Divided evenly, with the rounding remainder on the first session so the
    // session values always sum back to the gross exactly.
    sessionValue: toRupees(Math.floor(grossPaise / input.sessionCount)),
  };
}

/**
 * Splits a gross amount into per-session values that sum exactly to the
 * original — the remainder goes on the first session.
 */
export function splitSessionValues(
  grossAmount: number,
  sessionCount: number,
): number[] {
  const grossPaise = toPaise(grossAmount);
  const base = Math.floor(grossPaise / sessionCount);
  const remainder = grossPaise - base * sessionCount;

  return Array.from({ length: sessionCount }, (_, index) =>
    toRupees(index === 0 ? base + remainder : base),
  );
}
