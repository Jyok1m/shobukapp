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
  /* Set when an admin created the account: every route but /auth/me, /auth/logout and /auth/password answers 403 until changed. */
  mustChangePassword: boolean;
  termsAcceptedAt: string | null;
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

/* How often a cotisation is paid: each plan offers one to three of these (docs/billing.md, Frequencies). */
export type Frequency = "YEAR" | "QUARTER" | "MONTH";

export type PublicPlanPrice = {
  frequency: Frequency;
  amountCents: number;
  purchasable: boolean;
};

/* GET /billing/plans: active plans with at least one active price, prices ordered YEAR, QUARTER, MONTH. */
export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  /* Yearly entrance fee: charged with the first payment, then once a year. 0 when none. */
  entranceFeeCents: number;
  prices: PublicPlanPrice[];
};

export type AdminPlanPrice = {
  id: string;
  frequency: Frequency;
  amountCents: number;
  active: boolean;
  stripeTestPriceId: string | null;
  stripeLivePriceId: string | null;
};

export type AdminPlan = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  entranceFeeCents: number;
  prices: AdminPlanPrice[];
  stripeTestProductId: string | null;
  stripeLiveProductId: string | null;
  /* Product and every active price exist in the current Stripe mode. */
  synced: boolean;
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
  planId: string | null;
  planName: string | null;
  frequency: Frequency | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  manageable: boolean;
  /* Stripe test mode: payments are simulated. */
  testMode: boolean;
  /* Live mode, and the member had a cotisation paid in test mode: it does not carry over. */
  testCotisationNotCarried: boolean;
  /* The yearly entrance fee is paid until then: none due at the next checkout. */
  entranceFeePaidUntil: string | null;
  payments: Payment[];
};

/* Admin members (GET /admin/members), 50 per page. */
export type MembershipFilter = "active" | "past_due" | "none";

export type AdminMemberListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  createdAt: string;
  membership: {
    status: string | null;
    isMember: boolean;
    planName: string | null;
    frequency: Frequency | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  lastPayment: { paidAt: string | null; amountCents: number; currency: string } | null;
  failedPayments: number;
  lastReminderAt: string | null;
  /* Latest medical certificate, date only. */
  medicalCertificate: { validUntil: string | null } | null;
  /* This season's FFJDA licence and the sports passport, latest charge per product. */
  federation: { slug: string; name: string; status: ChargeStatus }[];
};

export type AdminMembersPage = {
  items: AdminMemberListItem[];
  nextCursor: string | null;
};

export type PaymentReminder = {
  id: string;
  note: string | null;
  createdAt: string;
  sentBy: { firstName: string; lastName: string } | null;
};

/* GET /admin/members/:id */
export type AdminMemberDetail = SelfUser & {
  /* Current subscription, picked by the API. */
  membership: AdminMemberListItem["membership"];
  subscriptions: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    frequency: Frequency | null;
    plan: { name: string } | null;
  }[];
  payments: Payment[];
  remindersReceived: PaymentReminder[];
  roleChanges: RoleChange[];
};

export type RoleChange = {
  fromRole: Role;
  toRole: Role;
  createdAt: string;
  changedBy: { firstName: string; lastName: string } | null;
};

export type StripeMode = "test" | "live";

/* GET and PUT /admin/settings/billing */
export type BillingSettings = {
  mode: StripeMode;
  configured: Record<StripeMode, boolean>;
  updatedAt: string | null;
  updatedBy: { firstName: string; lastName: string } | null;
  /* Only after a test to live switch: members told their demo cotisation is not carried over. */
  notified?: number;
};

/* POST /admin/members */
export type CreatedMember = { user: SelfUser; delivery: MailDelivery };

/* POST /admin/members/:id/reminders. "logged" means no SMTP server is configured. */
export type ReminderResult = {
  id: string;
  createdAt: string;
  note: string | null;
  delivery: "sent" | "logged";
};

export type DocumentCategory = "MEDICAL_CERTIFICATE" | "LEGAL" | "RULES" | "ACCOUNTING" | "OTHER";

/* Where a dojo document shows: admins only, the dashboard board, or the important list. */
export type Placement = "PRIVATE" | "ANNOUNCEMENT" | "IMPORTANT";

/* A member document (ownerId set) or a dojo document (ownerId null). */
export type MemberDocument = {
  id: string;
  ownerId: string | null;
  category: DocumentCategory;
  title: string;
  mimeType: string;
  sizeBytes: number;
  validUntil: string | null;
  /* Dojo documents only; a member document is always PRIVATE. */
  placement?: Placement;
  description?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* GET /documents/board: what every signed-in member sees on the dashboard. */
export type DocumentBoard = {
  announcements: MemberDocument[];
  important: MemberDocument[];
};

/* POST /billing/subscription/frequency/preview */
export type FrequencyPreview = { amountDueCents: number; creditCents: number; currency: string };

export type Discipline = "KENDO" | "IAIDO" | "JODO" | "BATTODO";

/* One row per member, season and discipline: the number is the season's, only the file differs. */
export type License = {
  id: string;
  userId: string;
  season: string;
  discipline: Discipline;
  number: string;
  hasFile: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/* Never email or phone: docs/messaging.md. */
export type Counterpart = {
  id: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  hasPhoto: boolean;
};

export type Conversation = {
  counterpart: Counterpart;
  lastMessage: Message;
  unread: number;
};

export type Thread = {
  counterpart: Counterpart;
  canWrite: boolean;
  items: Message[];
  nextCursor: string | null;
};

/* Onboarding (docs/onboarding.md). */
export type InvitationPreview = {
  email: string;
  firstName: string;
  lastName: string;
  expiresAt: string;
};

export type InvitationStatus = "PENDING" | "USED" | "REVOKED" | "EXPIRED" | "LOCKED";
export type InvitationKind = "LINK" | "CODE";
export type MailDelivery = "sent" | "logged" | "failed";

export type Invitation = {
  id: string;
  kind: InvitationKind;
  email: string;
  firstName: string;
  lastName: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  failedAttempts: number;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
  status: InvitationStatus;
  joinRequestId?: string | null;
};

export type JoinRequestStatus = "NEW" | "INVITED" | "DECLINED";

export type JoinRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  message: string;
  wantsTrial: boolean;
  /* Evenings offered by the visitor, ISO dates at midnight UTC (the calendar day is the first 10 characters). */
  trialDates: string[];
  /* Slot confirmed by an admin, ISO instant. */
  trialScheduledAt: string | null;
  status: JoinRequestStatus;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
  handledBy: { firstName: string; lastName: string } | null;
  invitation: Invitation | null;
};

export type JoinRequestsPage = {
  items: JoinRequest[];
  nextCursor: string | null;
};

/* POST /admin/join-requests/:id/trial */
export type TrialScheduleResult = JoinRequest & { delivery: MailDelivery };

/* POST /admin/join-requests/:id/invite */
export type LinkInvitationResult = { link: string; expiresAt: string; delivery: MailDelivery };

/* POST /admin/invitations: the code is only ever returned here. */
export type CodeInvitationResult = { code: string; expiresAt: string; delivery: MailDelivery };

/* One-off products (docs/billing.md, One-off products). */
export type ProductKind = "FEDERATION" | "MISC";

/* GET /admin/products */
export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: ProductKind;
  amountCents: number;
  currency: string;
  memberPurchasable: boolean;
  /* Due once per season (licence), not once for good. */
  perSeason: boolean;
  active: boolean;
};

/* GET /billing/products: what a member may buy alone. */
export type MemberProduct = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  purchasable: boolean;
};

export type ChargeStatus = "PENDING" | "PAID" | "DECLINED" | "WAIVED";
export type ChargeMethod = "STRIPE" | "MANUAL";

/* GET /admin/members/:id/charges and GET /billing/charges (the member sees a link only while pending). */
export type Charge = {
  id: string;
  amountCents: number;
  currency: string;
  status: ChargeStatus;
  method: ChargeMethod | null;
  season: string | null;
  note: string | null;
  stripePaymentLinkUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  product: { id: string; slug: string; name: string; kind: ProductKind };
};

/* POST /admin/members/:id/charges with sendLink, and POST /admin/charges/:id/link. */
export type ChargeWithDelivery = Charge & { delivery?: MailDelivery };
