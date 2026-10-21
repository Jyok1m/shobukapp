import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { chargeStatus, formatAmount, formatDate } from "@/lib/format";
import type { Charge, MemberProduct } from "@/lib/types";
import { BuyProductButton } from "./buy-product-button";
import { DemoPaymentNotice } from "./test-mode-notices";

function chargeTitle(charge: Charge): string {
  return charge.season ? `${charge.product.name} (saison ${charge.season})` : charge.product.name;
}

/* What the bureau asked the member to pay: the Stripe payment link while pending. */
export function PendingCharges({ charges }: { charges: Charge[] }) {
  if (charges.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {charges.map((charge) => (
        <li key={charge.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-medium text-ink">{chargeTitle(charge)}</p>
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{formatAmount(charge.amountCents, charge.currency)}</span>
              {" · "}demandé le {formatDate(charge.createdAt)}
            </p>
            {charge.note && <p className="text-sm whitespace-pre-line text-muted">{charge.note}</p>}
          </div>
          {charge.stripePaymentLinkUrl ? (
            <a
              href={charge.stripePaymentLinkUrl}
              rel="noopener noreferrer"
              className={buttonClasses("primary", "md", "shrink-0")}
              aria-label={`Payer : ${chargeTitle(charge)}`}
            >
              Payer
            </a>
          ) : (
            <p className="text-sm text-muted sm:max-w-56 sm:text-right">
              Le bureau vous enverra le lien de paiement, ou réglez sur place.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProductOffers({ products, testMode }: { products: MemberProduct[]; testMode: boolean }) {
  if (products.length === 0) return null;
  const purchasable = products.some((product) => product.purchasable);
  return (
    <div className="flex flex-col gap-4">
      {testMode && purchasable && <DemoPaymentNotice subject="achat" />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-serif text-lg font-semibold text-ink">{product.name}</h3>
              {product.description && <p className="text-sm whitespace-pre-line text-muted">{product.description}</p>}
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <span className="text-xl font-semibold text-ink">{formatAmount(product.amountCents, product.currency)}</span>
              {product.purchasable ? (
                <BuyProductButton productId={product.id} productName={product.name} />
              ) : (
                <p className="text-sm text-muted">Le paiement en ligne est momentanément indisponible.</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChargeHistory({ charges }: { charges: Charge[] }) {
  if (charges.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">Historique</h3>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface px-4 sm:px-5">
        {charges.map((charge) => {
          const status = chargeStatus(charge);
          return (
            <li key={charge.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-ink">{chargeTitle(charge)}</span>
                <span className="text-xs text-muted">
                  {formatDate(charge.status === "PAID" && charge.paidAt ? charge.paidAt : charge.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap text-ink">{formatAmount(charge.amountCents, charge.currency)}</span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
