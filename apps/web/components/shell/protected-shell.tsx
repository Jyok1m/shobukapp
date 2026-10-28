import { Suspense, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { BillingSettings, Role, StripeMode } from "@/lib/types";
import { AppShell } from "./app-shell";

/* Admins only: members never call /admin/settings. A failed read hides the banner, not the app. */
async function readBillingMode(role: Role): Promise<StripeMode | null> {
  if (role !== "ADMIN") return null;
  try {
    return (await apiGet<BillingSettings>("/admin/settings/billing")).mode;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

async function Gate({ role, children }: { role?: Role; children: ReactNode }) {
  const user = await requireUser(role);
  const billingMode = await readBillingMode(user.role);
  // Only what the client shell needs crosses the server/client boundary.
  return (
    <AppShell user={{ id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role }} billingMode={billingMode}>
      {children}
    </AppShell>
  );
}

function ShellFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-10" aria-busy>
      <span className="sr-only">Chargement</span>
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
      />
    </div>
  );
}

/* Session check behind Suspense (cookies() must not block the static shell). */
export function ProtectedShell({ role, children }: { role?: Role; children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Gate role={role}>{children}</Gate>
    </Suspense>
  );
}
