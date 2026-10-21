/* The dojo's public details, in one place: footer, landing, privacy page, app menu. */
export const DOJO = {
  name: "Shobukan Hombu Dojo",
  disciplines: "Iaido, kendo, battodo, jojutsu, fuzokubudo",
  street: "255, avenue Daumesnil",
  city: "75012 Paris",
  country: "France",
  phone: "01 43 07 05 65",
  phoneHref: "tel:+33143070565",
  email: "info@shobukan-dojo.com",
  website: "https://www.shobukan-dojo.com",
  mapsHref: "https://www.openstreetmap.org/search?query=255%20avenue%20Daumesnil%2075012%20Paris",
} as const;

/*
 * Opening evenings (Date#getUTCDay values: Monday, Wednesday, Friday). Twin of
 * OPEN_DAYS in apps/api/src/onboarding/trial.ts: change both together.
 */
export const OPEN_DAYS: readonly number[] = [1, 3, 5];
/* Trial class evenings a visitor may offer: from tomorrow up to this many days ahead, at most MAX_TRIAL_DATES. */
export const TRIAL_HORIZON_DAYS = 60;
export const MAX_TRIAL_DATES = 6;
/* Default start of a confirmed trial class, Paris time. */
export const DEFAULT_TRIAL_TIME = "19:30";
