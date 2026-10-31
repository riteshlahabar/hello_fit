import type { UserRole } from '../../generated/prisma/enums';

/** Which login issued the token. Admin and app accounts are separate tables. */
export type Audience = 'app' | 'admin';

/**
 * Access-token payload. Kept small — it travels on every request. Permissions
 * are included for admins so PermissionsGuard does not hit the database on
 * each call; they are re-read on refresh, so a revoked permission takes at
 * most one access-token lifetime (15 minutes) to take effect.
 */
export interface AccessTokenPayload {
  /** User.id for app accounts, AdminUser.id for admin accounts. */
  sub: string;
  aud: Audience;
  roles: UserRole[];
  /** Role slug, admin tokens only. */
  role?: string;
  /** "module:action" strings, admin tokens only. */
  perms?: string[];
  /** Branch scope, admin tokens only. Null or absent means all branches. */
  branchId?: string | null;
  deviceId?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  aud: Audience;
  /** RefreshToken row id, so rotation can mark the exact row replaced. */
  jti: string;
}

/** What JwtAuthGuard attaches to the request. */
export interface AuthenticatedUser {
  id: string;
  audience: Audience;
  roles: UserRole[];
  role?: string;
  permissions: string[];
  branchId?: string | null;
  deviceId?: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
