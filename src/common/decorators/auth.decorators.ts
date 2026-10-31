import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser, Audience } from '../auth/auth.types';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const PERMISSIONS_KEY = 'auth:permissions';
export const AUDIENCE_KEY = 'auth:audience';

/**
 * Opt a route out of authentication. JwtAuthGuard is global, so everything is
 * protected unless it carries this — the safe default is "locked".
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** App roles allowed on this route (CUSTOMER, INSTRUCTOR). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Admin permissions required, as "module:action" (e.g. "bookings:edit"). */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Restrict a route to one token audience. An admin token must not reach
 * /app/* routes and an app token must not reach /admin/*, even when the role
 * names happen to line up.
 */
export const AllowAudience = (audience: Audience) =>
  SetMetadata(AUDIENCE_KEY, audience);

/** Injects the authenticated user, or one of its fields. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
