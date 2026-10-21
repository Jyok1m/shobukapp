import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/session";
import type { Role } from "@/lib/types";
import { AppShell } from "./app-shell";

async function Gate({ role, children }: { role?: Role; children: ReactNode }) {
  const user = await requireUser(role);
  // Only what the client shell needs crosses the server/client boundary.
  return (
    <AppShell user={{ firstName: user.firstName, lastName: user.lastName, role: user.role }}>
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
