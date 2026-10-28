export type NavItem = { href: string; label: string };

export const memberNav: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/profil", label: "Mon profil" },
  { href: "/cotisation", label: "Ma cotisation" },
  { href: "/annuaire", label: "Annuaire" },
  { href: "/messagerie", label: "Messagerie" },
  { href: "/documents", label: "Mes documents" },
  { href: "/licences", label: "Mes licences" },
  { href: "/aide", label: "Aide" },
];

export const adminNav: NavItem[] = [
  { href: "/admin/demandes", label: "Demandes" },
  { href: "/admin/pratiquants", label: "Pratiquants" },
  { href: "/admin/formules", label: "Formules de cotisation" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/membres", label: "Membres" },
  { href: "/admin/licences", label: "Licences" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/documents", label: "Documents du dojo" },
];
