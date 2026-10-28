import { DOJO } from "@/lib/dojo";

export type TourVariant = "member" | "admin";

export type TourStep = {
  /* A menu link (its href) or "menu". Without one, the card is centred on a dimmed page. */
  target?: string;
  title: string;
  body: string;
};

/*
 * Written for people who rarely use a computer: one idea per step, the words
 * they will see on screen in quotes, no jargon. Each menu entry is reached on
 * a phone through the "Menu" button: the card then says so.
 */
export const tourSteps: Record<TourVariant, TourStep[]> = {
  member: [
    {
      title: "Bienvenue au Shobukan Dojo",
      body: "Cette courte visite vous montre où trouver chaque chose, une étape à la fois. Lisez à votre rythme, puis appuyez sur « Suivant ». Vous pouvez l'arrêter quand vous voulez et la revoir plus tard dans « Aide ».",
    },
    {
      target: "/tableau-de-bord",
      title: "Tableau de bord : votre page d'accueil",
      body: "Elle résume l'essentiel : votre cotisation, ce qui reste à payer et les annonces du dojo. Si vous ne savez plus où vous êtes, revenez ici.",
    },
    {
      target: "/profil",
      title: "Mon profil : à remplir en premier",
      body: "Vos coordonnées, votre photo et les informations demandées pour la licence de la fédération (date de naissance, adresse, personne à prévenir). Remplissez les cases puis appuyez sur « Enregistrer mon profil ». Vous y changez aussi votre mot de passe.",
    },
    {
      target: "/cotisation",
      title: "Ma cotisation : payer en ligne",
      body: "Choisissez votre formule, puis appuyez sur « Payer ma cotisation ». Le paiement par carte se fait sur une page sécurisée. Ensuite, « Gérer ma cotisation » vous donne vos factures et votre carte enregistrée.",
    },
    {
      target: "/documents",
      title: "Mes documents : le certificat médical",
      body: "Déposez ici votre certificat médical. Sur téléphone, vous pouvez le prendre en photo. Sur ordinateur, choisissez le fichier, puis appuyez sur « Envoyer le document ».",
    },
    {
      target: "/licences",
      title: "Mes licences : rien à faire",
      body: "Le dojo dépose ici votre licence de la fédération chaque saison. Vous pouvez la regarder ou la télécharger. Pensez seulement à garder votre profil complet.",
    },
    {
      target: "/annuaire",
      title: "Annuaire : les autres membres",
      body: "Les coordonnées des membres qui ont accepté de les partager. Vous n'y apparaissez que si vous le choisissez, dans « Mon profil ».",
    },
    {
      target: "/messagerie",
      title: "Messagerie : écrire à un membre",
      body: "Pour échanger en privé avec un autre membre. Quand vous avez un nouveau message, un petit chiffre apparaît à côté de « Messagerie ».",
    },
    {
      target: "/aide",
      title: "Aide : si vous êtes bloqué",
      body: `Vous y trouverez un guide pas à pas pour chaque démarche, et un bouton pour revoir cette visite. Pour toute question, le bureau répond au ${DOJO.phone}.`,
    },
  ],
  admin: [
    {
      title: "La partie administration",
      body: "En plus de votre espace de pratiquant, vous avez une rubrique « Administration » dans le menu pour gérer le dojo. Voici chaque entrée, une à la fois.",
    },
    {
      target: "/admin/demandes",
      title: "Demandes : les nouveaux venus",
      body: "Les personnes qui veulent découvrir le dojo écrivent depuis le site. Lisez la demande, proposez un cours d'essai si besoin, puis appuyez sur « Envoyer un lien d'inscription ». Un chiffre signale les nouvelles demandes.",
    },
    {
      target: "/admin/invitations",
      title: "Invitations : les pratiquants déjà au dojo",
      body: "Pour quelqu'un qui pratique déjà mais n'a pas de compte : indiquez son nom et son adresse e-mail puis « Créer le code ». Il reçoit un code par e-mail et crée son compte lui-même.",
    },
    {
      target: "/admin/pratiquants",
      title: "Pratiquants : qui est à jour",
      body: "Qui a payé sa cotisation et qui ne l'a pas fait. Le bouton « Relancer » envoie un rappel par e-mail, et la relance est notée.",
    },
    {
      target: "/admin/membres",
      title: "Membres : les fiches complètes",
      body: "Toutes les informations d'un membre : coordonnées, paiements, documents, licences. « Créer un membre » ouvre un compte pour quelqu'un qui ne peut pas le faire seul.",
    },
    {
      target: "/admin/licences",
      title: "Licences : le suivi avec la fédération",
      body: "Les demandes de licence à faire sur le site de la fédération, et l'export des informations à y recopier. Déposer la licence sur la fiche du membre clôt la demande.",
    },
    {
      target: "/admin/formules",
      title: "Formules de cotisation : les tarifs",
      body: "Les cotisations proposées aux pratiquants. À modifier avec précaution : elles sont reliées au paiement en ligne.",
    },
    {
      target: "/admin/produits",
      title: "Produits : les paiements ponctuels",
      body: "Licence et assurance, passeport sportif, cours particuliers. Depuis la fiche d'un membre, vous lui envoyez un lien de paiement.",
    },
    {
      target: "/admin/documents",
      title: "Documents du dojo",
      body: "Statuts, règlement, assurance, comptes. Ils sont privés au départ : c'est vous qui choisissez ceux que les membres peuvent voir.",
    },
    {
      target: "/aide",
      title: "C'est terminé",
      body: "Le guide de la page « Aide » reprend aussi les démarches d'administration pas à pas. Vous pouvez revoir cette visite à tout moment depuis cette page.",
    },
  ],
};
