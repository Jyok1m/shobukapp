"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordConfirmField } from "@/components/admin/members/password-confirm-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { BillingSettings, StripeMode } from "@/lib/types";

const modeCopy: Record<StripeMode, { badge: string; tone: "warning" | "success"; text: string }> = {
  test: {
    badge: "Mode test",
    tone: "warning",
    text: "Les paiements sont simulés, aucune carte n'est débitée. Les membres paient avec la carte de test 4242 4242 4242 4242.",
  },
  live: { badge: "Mode live", tone: "success", text: "Paiements réels : les cartes des membres sont débitées." },
};

/* GET and PUT /admin/settings/billing: the switch syncs every formule in the target mode first. */
export function BillingModeCard({ settings }: { settings: BillingSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState<number | null>(null);
  const target: StripeMode = settings.mode === "test" ? "live" : "test";
  const available = settings.configured[target];
  const current = modeCopy[settings.mode];

  async function confirm() {
    if (!password) return setError("Saisissez votre mot de passe pour confirmer.");
    setPending(true);
    setError(null);
    const result = await apiRequest<BillingSettings>("PUT", "/admin/settings/billing", { mode: target, password });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setPassword("");
    setNotified(result.data.notified ?? null);
    router.refresh();
  }

  return (
    <Card title="Paiements Stripe">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p>
            <Badge tone={current.tone} className="text-sm">
              {current.badge}
            </Badge>
          </p>
          <p className="text-sm text-ink">{current.text}</p>
          {notified !== null && (
            <Notice tone="success">
              {notified === 0
                ? "Aucun membre n'avait de cotisation de démonstration à prévenir."
                : `${notified} membre${notified > 1 ? "s" : ""} prévenu${notified > 1 ? "s" : ""} par e-mail.`}
            </Notice>
          )}
          {settings.updatedAt && (
            <p className="text-xs text-muted">
              Mode choisi le {formatDate(settings.updatedAt)}
              {settings.updatedBy ? `, par ${settings.updatedBy.firstName} ${settings.updatedBy.lastName}` : ""}.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant={target === "live" ? "primary" : "secondary"}
            disabled={!available}
            onClick={() => {
              setPassword("");
              setError(null);
              setOpen(true);
            }}
            className="self-start"
          >
            {target === "live" ? "Passer en mode live" : "Revenir en mode test"}
          </Button>
          {!available && (
            <p className="text-sm text-muted">
              {target === "live" ? "Clés Stripe live non configurées." : "Clés Stripe de test non configurées."}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={open}
        title={target === "live" ? "Passer en mode live ?" : "Revenir en mode test ?"}
        description={
          target === "live" ? (
            <div className="flex flex-col gap-2">
              <p>Les paiements deviennent réels.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Chaque formule active est d&apos;abord créée en mode live chez Stripe. Si Stripe refuse, rien ne change.</li>
                <li>Les cotisations payées en mode test ne comptent plus : personne n&apos;est membre grâce à une carte de test.</li>
                <li>Les membres devront payer de nouveau, avec une vraie carte.</li>
                <li>
                  Les membres qui avaient une cotisation de démonstration sont prévenus par e-mail. Ils gardent toutes
                  leurs données (profil, documents, messages), sauf cette cotisation de démonstration.
                </li>
              </ul>
            </div>
          ) : (
            "Les paiements redeviennent simulés. Seules les cotisations payées en mode test comptent à nouveau, et les cotisations live ne sont plus affichées tant que ce mode est actif."
          )
        }
        confirmLabel={target === "live" ? "Passer en mode live" : "Revenir en mode test"}
        confirmVariant={target === "live" ? "danger" : "primary"}
        pending={pending}
        error={error}
        confirmDisabled={!password}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        {target === "live" && <Notice tone="warning">Vérifiez avec le trésorier que le compte Stripe est prêt à encaisser.</Notice>}
        <PasswordConfirmField id="billing-password" value={password} onChange={setPassword} disabled={pending} />
      </ConfirmDialog>
    </Card>
  );
}
