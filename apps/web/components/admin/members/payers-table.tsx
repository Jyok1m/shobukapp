"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { MembershipBadge } from "@/components/membership-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Table, Td, Th } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import { certificateState } from "@/lib/documents";
import { cotisationLabel, formatAmount, formatShortDate } from "@/lib/format";
import type { AdminMembersPage } from "@/lib/types";
import { FederationBadges } from "./federation-badges";
import { fullName, type MemberQuery } from "./query";
import { ReminderDialog, reminderMessage, type ReminderTarget } from "./reminder-dialog";
import { useMemberPages } from "./use-member-pages";

function CertificateCell({ certificate }: { certificate: AdminMembersPage["items"][number]["medicalCertificate"] }) {
  const state = certificateState(certificate);
  const tone =
    state.tone === "danger" ? "font-semibold text-danger" : state.tone === "success" ? "text-ink" : "text-muted";
  return <Td className={cx("whitespace-nowrap", tone)}>{state.label}</Td>;
}

export function PayersTable({ initial, query }: { initial: AdminMembersPage; query: MemberQuery }) {
  const { items, hasMore, pending, error, loadMore, update } = useMemberPages(initial, query);
  const [target, setTarget] = useState<ReminderTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucun pratiquant"
        description={
          query.q || query.status
            ? "Aucun pratiquant ne correspond à cette recherche ou à ce filtre."
            : "Les pratiquants apparaîtront ici dès leur inscription."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && <Notice tone="success">{notice}</Notice>}
      <Table>
        <caption className="sr-only">Pratiquants et situation de paiement</caption>
        <thead>
          <tr>
            <Th>Pratiquant</Th>
            <Th>Formule</Th>
            <Th>Statut</Th>
            <Th>Dernier paiement</Th>
            <Th>Échecs</Th>
            <Th>Dernière relance</Th>
            <Th>Certificat médical</Th>
            <Th>Licence et passeport</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((member) => {
            const name = fullName(member);
            return (
              <tr key={member.id}>
                <Td className="min-w-44">
                  <Link href={`/admin/membres/${member.id}`} className="font-medium text-accent hover:underline">
                    {name}
                  </Link>
                  <span className="block truncate text-xs text-muted">{member.email}</span>
                </Td>
                <Td className="min-w-32">{cotisationLabel(member.membership.planName, member.membership.frequency) ?? (
                    <span className="text-muted">Aucune</span>
                  )}</Td>
                <Td className="whitespace-nowrap">
                  <MembershipBadge status={member.membership.status} />
                  {member.membership.cancelAtPeriodEnd && (
                    <span className="mt-1 block text-xs text-muted">Résiliation en fin de période</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {member.lastPayment ? (
                    <>
                      {formatAmount(member.lastPayment.amountCents, member.lastPayment.currency)}
                      {member.lastPayment.paidAt && (
                        <span className="block text-xs text-muted">{formatShortDate(member.lastPayment.paidAt)}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">Aucun</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  <span
                    className={cx(member.failedPayments > 0 ? "font-semibold text-danger" : "text-muted")}
                    aria-label={`${member.failedPayments} paiement${member.failedPayments > 1 ? "s" : ""} échoué${member.failedPayments > 1 ? "s" : ""}`}
                  >
                    {member.failedPayments}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  {member.lastReminderAt ? formatShortDate(member.lastReminderAt) : <span className="text-muted">Jamais</span>}
                </Td>
                <CertificateCell certificate={member.medicalCertificate} />
                <Td className="min-w-44">
                  <FederationBadges federation={member.federation} />
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setNotice(null);
                        setTarget({ id: member.id, name });
                      }}
                      aria-label={`Relancer ${name}`}
                    >
                      Relancer
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <FormAlert message={error} />
      {hasMore && (
        <Button variant="secondary" loading={pending} onClick={loadMore} className="self-center">
          Charger plus
        </Button>
      )}
      <ReminderDialog
        target={target}
        onClose={() => setTarget(null)}
        onSent={(result, sent) => {
          update(sent.id, { lastReminderAt: result.createdAt });
          setNotice(reminderMessage(result, sent.name));
          setTarget(null);
        }}
      />
    </div>
  );
}
