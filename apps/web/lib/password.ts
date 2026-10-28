/* Mirrors the API rule (docs/auth.md, Passwords): a length, no composition rules. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export function passwordLengthError(password: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères (${password.length} pour l'instant).`;
  if (password.length > PASSWORD_MAX) return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX} caractères.`;
  return null;
}
