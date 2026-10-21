import type { ApiErrorBody } from "./types";

/* French copy for the stable API error codes. Never show the raw API message. */
export const apiErrorMessages: Record<string, string> = {
  unauthenticated: "Votre session a expiré. Merci de vous reconnecter.",
  forbidden: "Vous n'avez pas accès à cette page.",
  invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
  email_taken: "Un compte existe déjà avec cette adresse e-mail.",
};

const statusMessages: Record<number, string> = {
  400: "Certaines informations sont invalides. Vérifiez le formulaire.",
  429: "Trop de tentatives. Patientez une minute avant de réessayer.",
};

export const genericErrorMessage = "Une erreur est survenue. Réessayez dans un instant.";

export function errorMessage(status: number, body: ApiErrorBody | null): string {
  if (body?.code && apiErrorMessages[body.code]) return apiErrorMessages[body.code];
  return statusMessages[status] ?? genericErrorMessage;
}

/* Reads an error response without throwing on a non JSON body. */
export async function readApiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return errorMessage(res.status, body);
}
