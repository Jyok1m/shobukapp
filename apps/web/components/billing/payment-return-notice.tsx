"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

const POLL_MS = 3000;
const MAX_POLLS = 10;

/*
 * Back from Stripe Checkout. The subscription only exists once the webhook has
 * landed, so a success return refreshes the page a few times until it shows.
 */
export function PaymentReturnNotice({ isMember }: { isMember: boolean }) {
  const router = useRouter();
  const outcome = useSearchParams().get("paiement");
  const [polls, setPolls] = useState(0);

  const waiting = outcome === "succes" && !isMember && polls < MAX_POLLS;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setPolls((count) => count + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, polls, router]);

  if (outcome === "annule") {
    return (
      <Notice className="mb-6">Paiement annulé. Aucun montant n&apos;a été débité, vous pouvez réessayer quand vous le souhaitez.</Notice>
    );
  }
  if (outcome !== "succes") return null;
  if (isMember) {
    return (
      <Notice tone="success" className="mb-6">
        Paiement reçu, votre abonnement est actif. Bienvenue au dojo !
      </Notice>
    );
  }
  return (
    <Notice tone="success" className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span>Paiement reçu, l&apos;activation peut prendre quelques secondes.</span>
      <Button
        variant="secondary"
        size="sm"
        loading={waiting}
        onClick={() => {
          setPolls(0);
          router.refresh();
        }}
      >
        Actualiser
      </Button>
    </Notice>
  );
}
