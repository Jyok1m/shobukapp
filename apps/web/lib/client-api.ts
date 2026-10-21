import { errorMessage, genericErrorMessage } from "./errors";
import type { ApiErrorBody } from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string | null; status: number };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/*
 * Browser call through the /api rewrite with the session cookie. Never throws:
 * the result carries a French message built from the API error code.
 * `body` is sent as JSON, except FormData which goes as multipart.
 */
export async function apiRequest<T = unknown>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const isForm = body instanceof FormData;
    const res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined || isForm ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    if (res.ok) {
      const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
      return { ok: true, data: data as T };
    }
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    // The temporary password was not replaced yet: nothing else works until it is.
    if (errorBody?.code === "password_change_required" && window.location.pathname !== "/premiere-connexion") {
      // A full load on purpose: this helper has no router, and every server component must re-read the session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/premiere-connexion");
    }
    return {
      ok: false,
      error: errorMessage(res.status, errorBody),
      code: errorBody?.code ?? null,
      status: res.status,
    };
  } catch {
    return { ok: false, error: genericErrorMessage, code: null, status: 0 };
  }
}
