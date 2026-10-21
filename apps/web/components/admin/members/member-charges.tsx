"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client-api";
import { chargeStatus, formatAmount, formatDate } from "@/lib/format";
import { deliveryMessage } from "@/lib/onboarding";
import type { AdminProduct, Charge, ChargeStatus, ChargeWithDelivery } from "@/lib/types";

type Outcome = { tone: "success" | "warning"; text: string; link: string | null };

/* What happened to the mail, with the link to pass on by hand when it did not leave. */
function linkOutcome(result: ChargeWithDelivery, action: string): Outcome {
  const link = result.stripePaymentLinkUrl;
  if (!result.delivery) return { tone: "success", text: `${action} Aucun e-mail envoyé.`, link: null };
  const info = deliveryMessage(result.delivery, "le lien");
  return { tone: info.ok ? "success" : "warning", text: `${action} ${info.text}`, link };
}

/* Status changes from "En attente" close the payment link: confirmed first. */
const statusActions: { status: Exclude<ChargeStatus, "PENDING">; label: string; title: string; description: string }[] = [
  {
    status: "PAID",
    label: "Payé (hors ligne)",
    title: "Enregistrer un paiement hors ligne ?",
    description: "Espèces, chèque ou virement reçu par le bureau. Le lien de paiement en ligne sera désactivé.",
  },
  {
    status: "DECLINED",
    label: "Refusé par le pratiquant",
    title: "Marquer comme refusé ?",
    description: "Le pratiquant ne souhaite pas régler ce produit. Le lien de paiement en ligne sera désactivé.",
  },
  {
    status: "WAIVED",
    label: "Offert",
    title: "Offrir ce produit ?",
    description: "Le dojo prend ce montant à sa charge. Le lien de paiement en ligne sera désactivé.",
  },
];

type PendingChange = { charge: Charge; status: ChargeStatus };

export function MemberCharges({
  memberId,
  charges,
  products,
}: {
  memberId: string;
  charges: Charge[];
  products: AdminProduct[];
}) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [change, setChange] = useState<PendingChange | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  const available = products.filter((product) => product.active);

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const productId = String(data.get("productId") ?? "");
    const note = String(data.get("note") ?? "").trim();
    const sendLink = data.get("sendLink") === "on";
    setFormError(null);
    setOutcome(null);
    setRowError(null);
    if (!productId) return setFormError("Choisissez un produit.");

    setRequesting(true);
    const result = await apiRequest<ChargeWithDelivery>("POST", `/admin/members/${memberId}/charges`, {
      productId,
      sendLink,
      ...(note && { note }),
    });
    setRequesting(false);
    // A Stripe failure after the request was recorded still leaves it in the list.
    router.refresh();
    if (!result.ok) return setFormError(result.error);
    setOutcome(linkOutcome(result.data, "Demande enregistrée."));
    setFormKey((key) => key + 1);
  }

  async function resend(charge: Charge) {
    setBusyId(charge.id);
    setRowError(null);
    setOutcome(null);
    const result = await apiRequest<ChargeWithDelivery>("POST", `/admin/charges/${charge.id}/link`);
    setBusyId(null);
    router.refresh();
    if (!result.ok) return setRowError(result.error);
    setOutcome(linkOutcome(result.data, `Lien de paiement « ${charge.product.name} » envoyé.`));
  }

  async function applyStatus(target: PendingChange): Promise<string | null> {
    setBusyId(target.charge.id);
    const result = await apiRequest<Charge>("PATCH", `/admin/charges/${target.charge.id}`, { status: target.status });
    setBusyId(null);
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  }

  async function confirmChange() {
    if (!change) return;
    setChangeError(null);
    const error = await applyStatus(change);
    if (error) return setChangeError(error);
    setChange(null);
  }

  async function reopen(charge: Charge) {
    setRowError(null);
    setOutcome(null);
    const error = await applyStatus({ charge, status: "PENDING" });
    if (error) setRowError(error);
  }

  const action = change ? statusActions.find((item) => item.status === change.status) : undefined;

  return (
    <Card
      title="Licence, passeport et achats"
      description="Paiements ponctuels hors cotisation. Le pratiquant reçoit un lien de paiement sécurisé, ou le bureau enregistre un règlement reçu sur place."
    >
      <div className="flex flex-col gap-6">
        {outcome && (
          <Notice tone={outcome.tone} className="flex flex-col gap-2">
            <span>{outcome.text}</span>
            {outcome.link && outcome.tone === "warning" && (
              <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <output className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm break-all text-ink select-all">
                  {outcome.link}
                </output>
                <CopyButton value={outcome.link} label="Copier le lien" />
              </span>
            )}
          </Notice>
        )}
        <FormAlert message={rowError} />

        {charges.length === 0 ? (
          <p className="text-sm text-muted">Aucune demande de paiement pour ce membre.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {charges.map((charge) => {
              const status = chargeStatus(charge);
              const busy = busyId === charge.id;
              const paidOnline = charge.status === "PAID" && charge.method === "STRIPE";
              return (
                <li key={charge.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-medium text-ink">
                        {charge.product.name}
                        {charge.season && <span className="font-normal text-muted"> · saison {charge.season}</span>}
                      </p>
                      <p className="text-xs text-muted">
                        Demandé le {formatDate(charge.createdAt)}
                        {charge.paidAt && charge.status === "PAID" && `, réglé le ${formatDate(charge.paidAt)}`}
                      </p>
                      {charge.note && <p className="text-sm whitespace-pre-line text-muted">{charge.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                      <span className="font-semibold whitespace-nowrap text-ink">
                        {formatAmount(charge.amountCents, charge.currency)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {charge.status === "PENDING" && (
                      <>
                        <Button variant="secondary" size="sm" loading={busy} onClick={() => resend(charge)}>
                          {charge.stripePaymentLinkUrl ? "Renvoyer le lien" : "Envoyer le lien"}
                        </Button>
                        {charge.stripePaymentLinkUrl && (
                          <CopyButton value={charge.stripePaymentLinkUrl} label="Copier le lien" />
                        )}
                        {statusActions.map((item) => (
                          <Button
                            key={item.status}
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setChangeError(null);
                              setChange({ charge, status: item.status });
                            }}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </>
                    )}
                    {charge.status !== "PENDING" && !paidOnline && (
                      <Button variant="ghost" size="sm" loading={busy} onClick={() => reopen(charge)}>
                        Remettre en attente
                      </Button>
                    )}
                    {paidOnline && (
                      <p className="text-xs text-muted">Payé en ligne : un remboursement se fait depuis Stripe.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form key={formKey} onSubmit={onRequest} className="flex flex-col gap-4 border-t border-line pt-6" noValidate>
          <h3 className="text-sm font-semibold text-ink">Demander un paiement</h3>
          {available.length === 0 ? (
            <p className="text-sm text-muted">Aucun produit actif. Activez-en un dans « Produits ».</p>
          ) : (
            <>
              <Field id="charge-product" label="Produit">
                {(control) => (
                  <Select {...control} name="productId" defaultValue="" required>
                    <option value="" disabled>
                      Choisir un produit
                    </option>
                    {available.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {formatAmount(product.amountCents, product.currency)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="charge-note" label="Note (facultatif)" hint="Ajoutée à l'e-mail envoyé au pratiquant.">
                {(control) => <Textarea {...control} name="note" maxLength={300} rows={2} />}
              </Field>
              <label htmlFor="charge-send-link" className="flex min-h-11 items-center gap-2 text-sm text-ink sm:min-h-0">
                <input
                  id="charge-send-link"
                  name="sendLink"
                  type="checkbox"
                  defaultChecked
                  className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                Envoyer le lien de paiement par e-mail
              </label>
              <FormAlert message={formError} />
              <Button type="submit" variant="secondary" loading={requesting} className="self-start">
                Demander le paiement
              </Button>
            </>
          )}
        </form>
      </div>

      <ConfirmDialog
        open={change !== null}
        title={action?.title ?? "Modifier le statut ?"}
        description={
          change && action
            ? `${change.charge.product.name}, ${formatAmount(change.charge.amountCents, change.charge.currency)}. ${action.description}`
            : undefined
        }
        confirmLabel={action?.label ?? "Confirmer"}
        confirmVariant="primary"
        pending={change !== null && busyId === change.charge.id}
        error={changeError}
        onConfirm={confirmChange}
        onCancel={() => setChange(null)}
      />
    </Card>
  );
}
