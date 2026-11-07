/**
 * Referral-code generation. Pure — no database, no HTTP — so the alphabet and
 * collision behaviour are unit-testable, like the other calculators.
 */

/**
 * Crockford-style alphabet: no I, L, O, U, or 0/1.
 *
 * Codes get read aloud and typed in by hand, so the characters people confuse
 * are removed rather than "handled". Dropping U also keeps the generator from
 * spelling anything unfortunate.
 */
export const REFERRAL_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export const REFERRAL_PREFIX = 'HF';
export const REFERRAL_BODY_LENGTH = 6;

/**
 * A code looks like `HF7K2MQ4`. 30^6 is ~729 million, so collisions are rare
 * but not impossible — the caller retries against the unique index rather than
 * trusting the odds.
 */
export function generateReferralCode(
  random: () => number = Math.random,
): string {
  let body = '';
  for (let i = 0; i < REFERRAL_BODY_LENGTH; i += 1) {
    const index = Math.floor(random() * REFERRAL_ALPHABET.length);
    body += REFERRAL_ALPHABET[index];
  }
  return REFERRAL_PREFIX + body;
}

/** Codes are stored and compared upper-case; users type them however. */
export function normaliseReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Matches the whole code. Built from the alphabet constant so the two can't
 * drift apart, and anchored so a longer string can't pass on a prefix match.
 */
const REFERRAL_PATTERN = new RegExp(
  `^${REFERRAL_PREFIX}[${REFERRAL_ALPHABET}]{${REFERRAL_BODY_LENGTH}}$`,
);

/**
 * Codes issued before this generator existed: `HF` + 8 hex characters, from
 * `randomBytes(4)`. They are live in the database and still printed on real
 * accounts, so rejecting them here would break a referral someone was given.
 * Accepted on input; never produced.
 */
const LEGACY_PATTERN = new RegExp(`^${REFERRAL_PREFIX}[0-9A-F]{8}$`);

/**
 * Shape check only — a cheap early-out before the lookup. The database is what
 * actually decides whether a code exists.
 */
export function isValidReferralCode(code: string): boolean {
  const normalised = normaliseReferralCode(code);
  return REFERRAL_PATTERN.test(normalised) || LEGACY_PATTERN.test(normalised);
}
