/**
 * Stable, machine-readable error codes. The Flutter app and admin panel switch
 * on these to show localised messages, so **never rename or reuse a code** —
 * add a new one instead. The HTTP status carries the category; the code carries
 * the specific cause.
 */
export const ErrorCode = {
  // Generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Auth
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',

  // Data
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',

  // Profile and addresses
  PROFILE_EXISTS: 'PROFILE_EXISTS',
  PROFILE_REQUIRED: 'PROFILE_REQUIRED',
  ADDRESS_LIMIT_REACHED: 'ADDRESS_LIMIT_REACHED',
  /** An upcoming session is still scheduled at this address. */
  ADDRESS_IN_USE: 'ADDRESS_IN_USE',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
