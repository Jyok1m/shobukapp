export type Role = "PRACTITIONER" | "ADMIN";

/* Mirrors the API projection (apps/api/src/common/public-user.ts), as serialized to JSON. */
export type PublicUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  photoKey: string | null;
  birthDate: string | null;
  sex: string | null;
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
