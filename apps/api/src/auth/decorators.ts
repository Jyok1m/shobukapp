import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Role } from '../generated/prisma/client';
import type { AuthenticatedRequest } from '../common/request';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';

export const Public = () => SetMetadata(IS_PUBLIC, true);
// Reachable while an admin-set temporary password has not been replaced yet.
export const AllowPendingPassword = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
