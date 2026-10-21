import { redirect } from "next/navigation";
import { getCurrentUser } from "./api";
import type { SelfUser, Role } from "./types";

/* Convenience redirects only: the API enforces every rule. */
export async function requireUser(role?: Role): Promise<SelfUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (role && user.role !== role) redirect("/tableau-de-bord");
  return user;
}

export async function redirectIfSignedIn(): Promise<null> {
  const user = await getCurrentUser();
  if (user) redirect("/tableau-de-bord");
  return null;
}
