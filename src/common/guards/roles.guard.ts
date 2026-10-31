import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/auth.decorators';
import { ErrorCode } from '../errors/error-codes';

/**
 * Checks app roles (CUSTOMER / INSTRUCTOR). A person may hold both, so this
 * passes when any required role is present.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Not permitted',
      });
    }

    if (!required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Your account role cannot access this resource',
      });
    }

    return true;
  }
}
