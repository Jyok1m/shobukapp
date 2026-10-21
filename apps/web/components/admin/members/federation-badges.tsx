import { Badge } from "@/components/ui/badge";
import { chargeStatuses } from "@/lib/format";
import type { AdminMemberListItem } from "@/lib/types";

/* Slugs of the products imported with the season grid (apps/api/src/billing/grids). */
const ITEMS = [
  { slug: "licence-assurance-ffjda", label: "Licence" },
  { slug: "passeport-sportif", label: "Passeport" },
] as const;

/* This season's licence and the passport, one compact line each. */
export function FederationBadges({ federation }: { federation: AdminMemberListItem["federation"] }) {
  return (
    <dl className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const status = federation?.find((entry) => entry.slug === item.slug)?.status;
        const state = status ? chargeStatuses[status] : undefined;
        return (
          <div key={item.slug} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd>
              {state ? (
                <Badge tone={state.tone}>{state.label}</Badge>
              ) : (
                <span className="text-xs whitespace-nowrap text-muted">Non demandé</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
