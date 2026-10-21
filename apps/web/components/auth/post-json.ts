import { genericErrorMessage, readApiError } from "@/lib/errors";

export type PostResult = { ok: true } | { ok: false; error: string };

/* Browser call through the /api rewrite, so the Set-Cookie of the API reaches the browser. */
export async function postJson(path: string, body?: unknown): Promise<PostResult> {
  try {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await readApiError(res) };
  } catch {
    return { ok: false, error: genericErrorMessage };
  }
}
