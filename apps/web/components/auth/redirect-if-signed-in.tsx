import { Suspense } from "react";
import { redirectIfSignedIn } from "@/lib/session";

async function Check() {
  return redirectIfSignedIn();
}

/* The form stays in the static shell; the session check streams in behind it. */
export function RedirectIfSignedIn() {
  return (
    <Suspense fallback={null}>
      <Check />
    </Suspense>
  );
}
