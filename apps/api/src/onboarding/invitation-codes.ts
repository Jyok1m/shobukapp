import { createHash, randomBytes, randomInt } from 'node:crypto';

// Crockford base32: no I, L, O, U, so a code read aloud or copied by hand
// survives the usual confusions.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 8;

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(32)];
  return code;
}

export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function generateLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export const MAX_FAILED_ATTEMPTS = 5;

export function invitationStatus(invitation: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  failedAttempts: number;
}): 'USED' | 'REVOKED' | 'EXPIRED' | 'LOCKED' | 'PENDING' {
  if (invitation.usedAt) return 'USED';
  if (invitation.revokedAt) return 'REVOKED';
  if (invitation.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  if (invitation.failedAttempts >= MAX_FAILED_ATTEMPTS) return 'LOCKED';
  return 'PENDING';
}
