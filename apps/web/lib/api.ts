import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { SelfUser } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/*
 * Server-side call to the API, forwarding the browser cookies (the session).
 * A Set-Cookie in the response does not reach the browser: mutate auth state
 * from the client through /api/* instead.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const outgoing = new Headers(init.headers);
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) outgoing.set("cookie", cookieHeader);
  if (typeof init.body === "string" && !outgoing.has("content-type")) outgoing.set("content-type", "application/json");

  return fetch(`${API_URL}${path}`, { ...init, headers: outgoing, cache: "no-store" });
}

/*
 * Server-side JSON read with the session. An expired session sends the user
 * to the login page; any other failure throws to the nearest error boundary.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 401) redirect("/connexion");
  if (!res.ok) throw new Error(`GET ${path} failed with status ${res.status}`);
  return (await res.json()) as T;
}

/* Public API read, without cookies (pages shown before signup). */
export async function publicApiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed with status ${res.status}`);
  return (await res.json()) as T;
}

/*
 * Preview of a signup link. The token never goes into an error message: those
 * end up in server logs and error digests. A 429 is an expected answer here.
 */
export async function getInvitationPreview<T>(
  token: string,
): Promise<{ kind: "ok"; data: T } | { kind: "invalid" } | { kind: "busy" }> {
  const res = await fetch(`${API_URL}/auth/invitations/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (res.status === 404) return { kind: "invalid" };
  if (res.status === 429) return { kind: "busy" };
  if (!res.ok) throw new Error(`GET /auth/invitations/:token failed with status ${res.status}`);
  return { kind: "ok", data: (await res.json()) as T };
}

/* Deduplicated per request: layouts and pages can all ask for the user. */
export const getCurrentUser = cache(async (): Promise<SelfUser | null> => {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed with status ${res.status}`);
  return (await res.json()) as SelfUser;
});
