"use client";

import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";
import { cx } from "@/lib/cx";

/*
 * Stripe Customer Portal: card, invoices, name, address, phone and cancellation,
 * outside our PCI scope. The URL comes from the API, never built here.
 */
export function PortalButton({
  variant = "primary",
  label = "Gérer ma cotisation",
  testMode = false,
  className,
}: {
  variant?: ButtonVariant;
  label?: string;
  /* Stripe test mode: the portal shows test cards and invoices. */
  testMode?: boolean;
  className?: string;
}) {
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
    <div className={cx("flex flex-col gap-2", className)}>
      <Button variant={variant} onClick={onClick} loading={pending}>
        {label}
      </Button>
      {testMode && (
        <p className="max-w-xs text-xs text-warning">
          Mode démonstration : les cartes et factures affichées sont fictives.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
