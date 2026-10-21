export type NavItem = { href: string; label: string };

export const memberNav: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/profil", label: "Mon profil" },
  { href: "/abonnement", label: "Mon abonnement" },
  { href: "/annuaire", label: "Annuaire" },
  { href: "/messagerie", label: "Messagerie" },
  { href: "/documents", label: "Mes documents" },
  { href: "/licences", label: "Mes licences" },
];

export const adminNav: NavItem[] = [
  { href: "/admin/demandes", label: "Demandes" },
  { href: "/admin/pratiquants", label: "Pratiquants" },
  { href: "/admin/formules", label: "Formules" },
  { href: "/admin/membres", label: "Membres" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/documents", label: "Documents du dojo" },
];
