import type { PlanInterval, ProductKind } from '../../generated/prisma/enums';
import { grid2026 } from './2026-2027';

export type GridPlan = {
  slug: string;
  name: string;
  description: string;
  entranceFeeCents: number;
  prices: Partial<Record<PlanInterval, number>>;
};

export type GridProduct = {
  slug: string;
  name: string;
  description: string;
  kind: ProductKind;
  amountCents: number;
  memberPurchasable: boolean;
  perSeason: boolean;
};

export type Grid = {
  season: string;
  plans: GridPlan[];
  products: GridProduct[];
};

/*
 * One file per season, from the dojo's printed grid. A new season is a new
 * file: importing it updates the same plans (by slug), so existing members
 * move to the new prices at their next renewal (docs/billing.md, Seasons).
 */
export const GRIDS: Record<string, Grid> = {
  [grid2026.season]: grid2026,
};
