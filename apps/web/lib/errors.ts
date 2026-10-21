import type { ApiErrorBody } from "./types";

/* French copy for the stable API error codes. Never show the raw API message. */
export const apiErrorMessages: Record<string, string> = {
  unauthenticated: "Votre session a expiré. Merci de vous reconnecter.",
  forbidden: "Vous n'avez pas accès à cette page.",
  invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
  email_taken: "Un compte existe déjà avec cette adresse e-mail.",
  not_found: "Élément introuvable. Il a peut-être été supprimé.",
  file_too_large: "Le fichier dépasse la taille maximale de 5 Mo.",
  unsupported_file_type: "Format non pris en charge. Utilisez une image JPEG, PNG ou WebP.",
  file_required: "Choisissez un fichier avant d'envoyer.",
  invalid_cursor: "Impossible de charger la suite de la liste. Rechargez la page.",
  already_subscribed: "Vous avez déjà un abonnement en cours. Gérez-le depuis \"Gérer mon abonnement\".",
  plan_not_found: "Cette formule n'est plus disponible.",
  billing_disabled: "Le paiement en ligne est momentanément indisponible.",
  no_billing_account: "Aucun compte de facturation n'est encore associé à votre profil.",
};

const statusMessages: Record<number, string> = {
  400: "Certaines informations sont invalides. Vérifiez le formulaire.",
  413: "Le fichier dépasse la taille maximale de 5 Mo.",
  429: "Trop de tentatives. Patientez une minute avant de réessayer.",
  503: "Le service est momentanément indisponible.",
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
