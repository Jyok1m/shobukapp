"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";

/* Opens Stripe Checkout for a one-off product: the API builds the session and its return URLs. */
export function BuyProductButton({ productId, productName }: { productId: string; productName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const result = await apiRequest<{ url: string }>("POST", `/billing/products/${productId}/checkout`);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    // Stays pending while the browser leaves for Stripe.
    window.location.assign(result.data.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={onClick} loading={pending} className="w-full" aria-label={`Acheter : ${productName}`}>
        Acheter
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
