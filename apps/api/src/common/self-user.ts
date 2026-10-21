import type { Prisma } from '../generated/prisma/client';

/*
 * The user as seen by themself (/auth/me, /me) and by admins: every profile
 * field, never password_hash. Never use it to show a user to another member:
 * the directory has its own select (docs/members.md).
 */
export const selfUserSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  photoKey: true,
  birthDate: true,
  sex: true,
  nationality: true,
  addressLine: true,
  postalCode: true,
  city: true,
  country: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  directoryVisible: true,
  mustChangePassword: true,
  termsAcceptedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type SelfUser = Prisma.UserGetPayload<{
  select: typeof selfUserSelect;
}>;
