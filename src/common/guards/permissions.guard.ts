import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/auth.decorators';
import { ErrorCode } from '../errors/error-codes';

/** Role slug that bypasses the permission matrix entirely. */
export const SUPER_ADMIN_SLUG = 'super-admin';

/**
 * Admin-side authorisation: every required "module:action" must be present.
 * Unlike RolesGuard this is AND, not OR — a route that both reads and approves
 * requires both permissions.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Not permitted',
      });
    }

    if (user.role === SUPER_ADMIN_SLUG) return true;

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have permission to perform this action',
        details: { missing },
      });
    }

    return true;
  }
}
