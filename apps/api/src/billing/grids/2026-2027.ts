import type { Grid } from './index';

const DISCIPLINES = 'Iaido, kendo, battodo, jojutsu ou fuzokubudo.';

/*
 * COTISATIONS 2026 / 2027 (1 unité = 1 discipline une fois par semaine).
 * Printed: quarterly and yearly for adults, quarterly for children. Derived
 * at the owner's request: monthly = quarterly / 3, children yearly =
 * quarterly x 4 (no yearly discount printed for them).
 */
export const grid2026: Grid = {
  season: '2026-2027',
  plans: [
    {
      slug: 'adulte-1-unite',
      name: 'Adulte · 1 unité par semaine',
      description: `${DISCIPLINES} Droit d'entrée annuel : 60 €.`,
      entranceFeeCents: 6000,
      prices: { YEAR: 73500, QUARTER: 24000, MONTH: 8000 },
    },
    {
      slug: 'adulte-2-unites',
      name: 'Adulte · 2 unités par semaine',
      description: `${DISCIPLINES} Droit d'entrée annuel : 60 €.`,
      entranceFeeCents: 6000,
      prices: { YEAR: 99600, QUARTER: 33000, MONTH: 11000 },
    },
    {
      slug: 'adulte-3-unites',
      name: 'Adulte · 3 unités par semaine',
      description: `${DISCIPLINES} Droit d'entrée annuel : 60 €.`,
      entranceFeeCents: 6000,
      prices: { YEAR: 110400, QUARTER: 37500, MONTH: 12500 },
    },
    {
      slug: 'adulte-a-volonte',
      name: 'Adulte · à volonté',
      description: `${DISCIPLINES} Droit d'entrée annuel : 60 €.`,
      entranceFeeCents: 6000,
      prices: { YEAR: 132000, QUARTER: 45000, MONTH: 15000 },
    },
    {
      slug: 'enfant-1-unite',
      name: 'Enfant (jusqu’à 14 ans) · 1 unité par semaine',
      description: `${DISCIPLINES} Droit d'entrée annuel : 45 €.`,
      entranceFeeCents: 4500,
      prices: { YEAR: 58000, QUARTER: 14500, MONTH: 4833 },
    },
    {
      slug: 'enfant-2-unites',
      name: 'Enfant (jusqu’à 14 ans) · 2 unités par semaine',
      description: `${DISCIPLINES} Droit d'entrée annuel : 45 €.`,
      entranceFeeCents: 4500,
      prices: { YEAR: 78000, QUARTER: 19500, MONTH: 6500 },
    },
  ],
  products: [
    {
      slug: 'licence-assurance-ffjda',
      name: 'Licence et assurance FFJDA',
      description: 'Pour la saison en cours.',
      kind: 'FEDERATION',
      amountCents: 5600,
      memberPurchasable: false,
      perSeason: true,
    },
    {
      slug: 'passeport-sportif',
      name: 'Passeport sportif',
      description: 'Valable 8 ans.',
      kind: 'FEDERATION',
      amountCents: 1000,
      memberPurchasable: false,
      perSeason: false,
    },
    {
      slug: 'cours-particulier',
      name: 'Cours particulier',
      description: 'Une heure.',
      kind: 'MISC',
      amountCents: 6000,
      memberPurchasable: true,
      perSeason: false,
    },
    {
      slug: 'pratiquant-de-passage',
      name: 'Pratiquant de passage',
      description: 'Un cours.',
      kind: 'MISC',
      amountCents: 2500,
      memberPurchasable: true,
      perSeason: false,
    },
  ],
};
