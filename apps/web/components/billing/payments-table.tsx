import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { formatAmount, formatShortDate, paymentStatuses } from "@/lib/format";
import type { Payment } from "@/lib/types";

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return <EmptyState title="Aucun paiement" description="Vos paiements apparaîtront ici après votre premier règlement." />;
  }
  return (
    <Table>
      <caption className="sr-only">Historique des paiements</caption>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Montant</Th>
          <Th>Statut</Th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => {
          const status = paymentStatuses[payment.status] ?? { label: payment.status, tone: "neutral" as const };
          return (
            <tr key={payment.id}>
              <Td className="whitespace-nowrap">{formatShortDate(payment.paidAt ?? payment.createdAt)}</Td>
              <Td className="whitespace-nowrap">{formatAmount(payment.amountCents, payment.currency)}</Td>
              <Td>
                <Badge tone={status.tone}>{status.label}</Badge>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
