export type Role = "PRACTITIONER" | "ADMIN";
export type Sex = "FEMALE" | "MALE";

/* The signed-in user as returned by /auth/me and /me (apps/api/src/common/self-user.ts), as JSON. */
export type SelfUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  photoKey: string | null;
  birthDate: string | null;
  sex: Sex | null;
  nationality: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  directoryVisible: boolean;
  createdAt: string;
};

export type ApiErrorBody = {
  code?: string;
  message?: string | string[];
  statusCode?: number;
};

/* Directory projection (GET /members): never more than what other members may see. */
export type DirectoryMember = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  hasPhoto: boolean;
};

export type DirectoryPage = {
  items: DirectoryMember[];
  nextCursor: string | null;
};

export type PlanInterval = "MONTH" | "YEAR";

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  interval: PlanInterval;
  purchasable: boolean;
};

export type AdminPlan = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  interval: PlanInterval;
  stripeProductId: string | null;
  stripePriceId: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentStatus = "PAID" | "FAILED" | "OPEN";

export type Payment = {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
};

/* GET /billing/subscription. `status` is the raw Stripe subscription status. */
export type Membership = {
  status: string | null;
  isMember: boolean;
  planName: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  manageable: boolean;
  payments: Payment[];
};
