"use client";

import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";

/* Stripe Customer Portal: card, invoices and cancellation, outside our PCI scope. */
export function PortalButton({ variant = "primary" }: { variant?: ButtonVariant }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const result = await apiRequest<{ url: string }>("POST", "/billing/portal");
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    window.location.assign(result.data.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} onClick={onClick} loading={pending}>
        Gérer mon abonnement
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
