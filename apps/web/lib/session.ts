import { redirect } from "next/navigation";
import { getCurrentUser } from "./api";
import type { SelfUser, Role } from "./types";

/*
 * Convenience redirects only: the API enforces every rule. An account still on
 * its admin-set temporary password goes to /premiere-connexion: every other
 * API route would answer 403 password_change_required.
 */
export async function requireUser(role?: Role): Promise<SelfUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.mustChangePassword) redirect("/premiere-connexion");
  if (role && user.role !== role) redirect("/tableau-de-bord");
  return user;
}

/* For /premiere-connexion only: signed in, temporary password still in place. */
export async function requirePasswordChange(): Promise<SelfUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.mustChangePassword) redirect("/tableau-de-bord");
  return user;
}

export async function redirectIfSignedIn(): Promise<null> {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/premiere-connexion" : "/tableau-de-bord");
  return null;
}
