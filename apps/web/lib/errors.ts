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
  already_subscribed: "Vous avez déjà une cotisation en cours. Gérez-la depuis « Gérer ma cotisation ».",
  plan_not_found: "Cette formule n'est plus disponible.",
  billing_disabled: "Le paiement en ligne est momentanément indisponible.",
  no_billing_account: "Aucun compte de facturation n'est encore associé à votre profil.",
  member_not_found: "Ce membre est introuvable. Il a peut-être été supprimé.",
  cannot_delete_self: "Vous ne pouvez pas supprimer votre propre compte depuis l'administration.",
  stripe_error: "Le service de paiement a rencontré une erreur, réessayez.",
  password_confirmation_failed: "Mot de passe incorrect. Saisissez le mot de passe de votre propre compte.",
  cannot_change_own_role: "Vous ne pouvez pas modifier votre propre rôle.",
  last_admin: "Impossible : c'est le dernier administrateur du dojo. Nommez d'abord un autre administrateur.",
  stripe_mode_unavailable: "Ce mode n'est pas disponible : les clés Stripe correspondantes ne sont pas configurées.",
  password_change_required: "Choisissez votre propre mot de passe avant de continuer.",
  password_unchanged: "Le nouveau mot de passe doit être différent du mot de passe provisoire.",
  terms_required: "Vous devez accepter les conditions d'utilisation pour continuer.",
  no_frequency_offered: "Proposez au moins une fréquence de paiement.",
  duplicate_frequency: "Chaque fréquence de paiement ne peut apparaître qu'une fois par formule.",
  no_active_cotisation: "Vous n'avez pas de cotisation en cours à modifier.",
  same_frequency: "C'est déjà votre fréquence de paiement actuelle.",
  payment_declined: "Le paiement a été refusé : votre fréquence actuelle est conservée.",
  frequency_not_offered: "Cette fréquence n'est plus proposée pour votre cotisation.",
  not_publishable: "Ce document ne peut pas être publié : seuls les documents du dojo peuvent l'être.",
  invalid_invitation: "Ce lien ou ce code d'inscription n'est plus valable.",
  join_request_not_found: "Cette demande est introuvable. Elle a peut-être été supprimée.",
  invalid_trial_dates:
    "Certains soirs choisis ne sont plus disponibles. Choisissez un lundi, un mercredi ou un vendredi, entre demain et les deux prochains mois.",
  invalid_trial_slot: "Choisissez un lundi, un mercredi ou un vendredi à venir.",
  no_trial_requested: "Cette personne n'a pas demandé de cours d'essai.",
  product_not_found: "Ce produit n'est plus disponible.",
  product_inactive: "Ce produit est désactivé : réactivez-le dans « Produits » avant de le demander.",
  charge_exists: "Déjà demandé ou réglé pour cette saison.",
  charge_not_found: "Cette demande de paiement est introuvable. Elle a peut-être été supprimée.",
  charge_not_pending: "Cette demande n'est plus en attente : le lien ne peut plus être envoyé.",
  charge_paid_online:
    "Payé en ligne : le statut ne peut pas être modifié ici. Un remboursement se fait depuis le tableau de bord Stripe.",
  invitation_not_found: "Cette invitation n'est plus en attente : elle a déjà été utilisée, révoquée ou a expiré.",
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
