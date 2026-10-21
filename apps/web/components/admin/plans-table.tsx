"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { apiRequest } from "@/lib/client-api";
import { formatAmount, intervalNames } from "@/lib/format";
import type { AdminPlan } from "@/lib/types";
import { PlanEditDialog } from "./plan-edit-dialog";

export function PlansTable({ plans }: { plans: AdminPlan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [archiving, setArchiving] = useState<AdminPlan | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    if (!archiving) return;
    setPendingId(archiving.id);
    setArchiveError(null);
    const result = await apiRequest<AdminPlan>("DELETE", `/admin/plans/${archiving.id}`);
    setPendingId(null);
    if (!result.ok) return setArchiveError(result.error);
    setArchiving(null);
    router.refresh();
  }

  async function reactivate(plan: AdminPlan) {
    setPendingId(plan.id);
    setError(null);
    const result = await apiRequest<AdminPlan>("PATCH", `/admin/plans/${plan.id}`, { active: true });
    setPendingId(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  if (plans.length === 0) {
    return (
      <EmptyState
        title="Aucune formule"
        description="Créez votre première formule ci-dessus pour permettre aux pratiquants d'adhérer en ligne."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormAlert message={error} />
      <Table>
        <caption className="sr-only">Formules du dojo, y compris les formules archivées</caption>
        <thead>
          <tr>
            <Th>Formule</Th>
            <Th>Tarif</Th>
            <Th>Stripe</Th>
            <Th>Statut</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const synced = Boolean(plan.stripeProductId && plan.stripePriceId);
            return (
              <tr key={plan.id} className={plan.active ? undefined : "bg-paper/60"}>
                <Td className="min-w-48">
                  <p className="font-medium">{plan.name}</p>
                  {plan.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{plan.description}</p>}
                </Td>
                <Td className="whitespace-nowrap">
                  {formatAmount(plan.amountCents, plan.currency)}
                  <span className="block text-xs text-muted">{intervalNames[plan.interval]}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={synced ? "success" : "danger"}>
                    {synced ? "Synchronisé avec Stripe" : "Non synchronisé"}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={plan.active ? "success" : "neutral"}>{plan.active ? "Active" : "Archivée"}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(plan)} disabled={pendingId === plan.id}>
                      Modifier
                    </Button>
                    {plan.active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => {
                          setArchiveError(null);
                          setArchiving(plan);
                        }}
                      >
                        Archiver
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={pendingId === plan.id}
                        onClick={() => reactivate(plan)}
                      >
                        Réactiver
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <PlanEditDialog
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={archiving !== null}
        title={archiving ? `Archiver « ${archiving.name} » ?` : "Archiver la formule ?"}
        description="La formule ne sera plus proposée aux pratiquants et son prix sera désactivé dans Stripe. Les abonnés actuels continuent d'être prélevés. Vous pourrez la réactiver plus tard."
        confirmLabel="Archiver"
        pending={archiving !== null && pendingId === archiving.id}
        error={archiveError}
        onConfirm={archive}
        onCancel={() => setArchiving(null)}
      />
    </div>
  );
}
