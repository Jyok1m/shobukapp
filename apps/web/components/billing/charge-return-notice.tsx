"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

const POLL_MS = 3000;
const MAX_POLLS = 5;

/*
 * Back from a one-off payment (payment link or member checkout). The redirect
 * proves nothing: only the Stripe webhook settles the charge, so the page
 * refreshes a few times while it lands.
 */
export function ChargeReturnNotice() {
  const router = useRouter();
  const outcome = useSearchParams().get("paiement");
  const [polls, setPolls] = useState(0);
  const waiting = outcome === "succes" && polls < MAX_POLLS;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setPolls((count) => count + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, polls, router]);

  if (outcome !== "succes") return null;
  return (
    <Notice tone="success" className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span>Merci, votre paiement est en cours d&apos;enregistrement. Il apparaîtra comme réglé d&apos;ici quelques instants.</span>
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
