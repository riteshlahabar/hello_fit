import { DEFAULT_SETTINGS } from '../settings/settings.defaults';
import { computeRefund, evaluateReschedule } from './refund.calculator';

const slabs = DEFAULT_SETTINGS.refundSlabs;
const reschedulePolicy = DEFAULT_SETTINGS.reschedulePolicy;

const NOW = new Date('2026-11-01T10:00:00Z');
const hoursFromNow = (hours: number): Date =>
  new Date(NOW.getTime() + hours * 3_600_000);

const base = {
  sessionValue: 1000,
  now: NOW,
  hasCheckedIn: false,
  cancelledBy: 'CUSTOMER' as const,
};

describe('computeRefund — customer cancellation slabs', () => {
  it('refunds in full beyond 24 hours', () => {
    const result = computeRefund({ ...base, startsAt: hoursFromNow(30) }, slabs);

    expect(result.slab).toBe('MORE_THAN_24H');
    expect(result.amount).toBe(1000);
  });

  it('refunds 75% between 2 and 24 hours', () => {
    const result = computeRefund({ ...base, startsAt: hoursFromNow(10) }, slabs);

    expect(result.slab).toBe('BETWEEN_2H_AND_24H');
    expect(result.amount).toBe(750);
  });

  it('refunds 50% under 2 hours', () => {
    const result = computeRefund({ ...base, startsAt: hoursFromNow(1) }, slabs);

    expect(result.slab).toBe('LESS_THAN_2H');
    expect(result.amount).toBe(500);
  });

  it('treats the 24-hour boundary as the better slab for the customer', () => {
    const result = computeRefund({ ...base, startsAt: hoursFromNow(24) }, slabs);

    expect(result.slab).toBe('MORE_THAN_24H');
  });

  it('treats the 2-hour boundary as the better slab for the customer', () => {
    const result = computeRefund({ ...base, startsAt: hoursFromNow(2) }, slabs);

    expect(result.slab).toBe('BETWEEN_2H_AND_24H');
  });

  it('refunds nothing once the teacher has checked in, however early', () => {
    const result = computeRefund(
      { ...base, startsAt: hoursFromNow(30), hasCheckedIn: true },
      slabs,
    );

    expect(result.slab).toBe('AFTER_CHECK_IN');
    expect(result.amount).toBe(0);
  });

  it('refunds nothing for a session already in the past', () => {
    const result = computeRefund(
      { ...base, startsAt: hoursFromNow(-3) },
      slabs,
    );

    expect(result.amount).toBe(500);
  });
});

describe('computeRefund — provider fault', () => {
  it('refunds in full plus goodwill when the teacher cancels, even at the last minute', () => {
    const result = computeRefund(
      { ...base, startsAt: hoursFromNow(0.5), cancelledBy: 'INSTRUCTOR' },
      slabs,
    );

    expect(result.amount).toBe(1000);
    expect(result.goodwillCredit).toBe(100);
  });

  it('refunds in full when admin cancels', () => {
    const result = computeRefund(
      { ...base, startsAt: hoursFromNow(1), cancelledBy: 'ADMIN' },
      slabs,
    );

    expect(result.amount).toBe(1000);
  });

  it('refunds in full plus goodwill on a teacher no-show', () => {
    const result = computeRefund(
      { ...base, startsAt: hoursFromNow(-1), cancelledBy: 'INSTRUCTOR_NO_SHOW' },
      slabs,
    );

    expect(result.amount).toBe(1000);
    expect(result.goodwillCredit).toBe(100);
  });

  it('refunds nothing on a customer no-show, since the customer is charged', () => {
    const result = computeRefund(
      { ...base, startsAt: hoursFromNow(-1), cancelledBy: 'CUSTOMER_NO_SHOW' },
      slabs,
    );

    expect(result.amount).toBe(0);
  });
});

describe('evaluateReschedule', () => {
  const rebase = {
    now: NOW,
    rescheduleCount: 0,
    hasCheckedIn: false,
  };

  it('is free beyond 24 hours', () => {
    const result = evaluateReschedule(
      { ...rebase, startsAt: hoursFromNow(48) },
      reschedulePolicy,
    );

    expect(result).toEqual({ allowed: true, chargeable: false, reason: 'FREE' });
  });

  it('allows one free reschedule inside 24 hours', () => {
    const result = evaluateReschedule(
      { ...rebase, startsAt: hoursFromNow(10) },
      reschedulePolicy,
    );

    expect(result).toMatchObject({ allowed: true, chargeable: false });
  });

  it('charges the second reschedule inside 24 hours', () => {
    const result = evaluateReschedule(
      { ...rebase, startsAt: hoursFromNow(10), rescheduleCount: 1 },
      reschedulePolicy,
    );

    expect(result).toMatchObject({
      allowed: true,
      chargeable: true,
      reason: 'FREE_QUOTA_EXHAUSTED',
    });
  });

  it('refuses inside 2 hours', () => {
    const result = evaluateReschedule(
      { ...rebase, startsAt: hoursFromNow(1) },
      reschedulePolicy,
    );

    expect(result).toEqual({ allowed: false, reason: 'TOO_LATE' });
  });

  it('refuses once checked in', () => {
    const result = evaluateReschedule(
      { ...rebase, startsAt: hoursFromNow(48), hasCheckedIn: true },
      reschedulePolicy,
    );

    expect(result).toEqual({ allowed: false, reason: 'ALREADY_CHECKED_IN' });
  });
});
