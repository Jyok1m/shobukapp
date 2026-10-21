import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './guards';

function context(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();

  it('lets through a route without @Roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(new RolesGuard(reflector).canActivate(context(undefined))).toBe(
      true,
    );
  });

  it('refuses a practitioner on an admin route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() =>
      new RolesGuard(reflector).canActivate(context({ role: 'PRACTITIONER' })),
    ).toThrow(ForbiddenException);
  });

  it('refuses when no user was resolved (guard order reversed)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() =>
      new RolesGuard(reflector).canActivate(context(undefined)),
    ).toThrow();
  });

  it('lets an admin through', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(
      new RolesGuard(reflector).canActivate(context({ role: 'ADMIN' })),
    ).toBe(true);
  });
});
