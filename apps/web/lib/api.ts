import { cookies } from "next/headers";
import { cache } from "react";
import type { PublicUser } from "./types";

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

  return fetch(`${API_URL}${path}`, { ...init, headers: outgoing });
}

/* Deduplicated per request: layouts and pages can all ask for the user. */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed with status ${res.status}`);
  return (await res.json()) as PublicUser;
});
