import { MembershipBadge } from "@/components/membership-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { formatShortDate } from "@/lib/format";
import type { AdminMemberDetail } from "@/lib/types";

export function SubscriptionsTable({ subscriptions }: { subscriptions: AdminMemberDetail["subscriptions"] }) {
  if (subscriptions.length === 0) {
    return <EmptyState title="Aucun abonnement" description="Ce membre n'a encore souscrit aucune formule." />;
  }
  return (
    <Table>
      <caption className="sr-only">Historique des abonnements</caption>
      <thead>
        <tr>
          <Th>Formule</Th>
          <Th>Statut</Th>
          <Th>Souscrit le</Th>
          <Th>Fin de période</Th>
        </tr>
      </thead>
      <tbody>
        {subscriptions.map((subscription, index) => (
          <tr key={`${subscription.createdAt}-${index}`}>
            <Td className="min-w-40">{subscription.plan?.name ?? <span className="text-muted">Formule supprimée</span>}</Td>
            <Td className="whitespace-nowrap">
              <MembershipBadge status={subscription.status} />
              {subscription.cancelAtPeriodEnd && (
                <span className="mt-1 block text-xs text-muted">Résiliation en fin de période</span>
              )}
            </Td>
            <Td className="whitespace-nowrap">{formatShortDate(subscription.createdAt)}</Td>
            <Td className="whitespace-nowrap">
              {subscription.currentPeriodEnd ? formatShortDate(subscription.currentPeriodEnd) : "Non renseignée"}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
