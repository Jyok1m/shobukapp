import { CopyButton } from "@/components/ui/copy-button";
import { formatDate } from "@/lib/format";
import { deliveryMessage } from "@/lib/onboarding";
import type { MailDelivery } from "@/lib/types";
import { cx } from "@/lib/cx";

/* Result of an invitation: the link or the code, a copy button, and what happened to the mail. */
export function DeliveryPanel({
  kind,
  value,
  expiresAt,
  delivery,
  once = false,
}: {
  kind: "link" | "code";
  value: string;
  expiresAt: string;
  delivery: MailDelivery;
  once?: boolean;
}) {
  const info = deliveryMessage(delivery, kind === "link" ? "le lien" : "le code");
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success-soft/40 p-4">
      <p className="text-sm font-semibold text-ink">
        {kind === "link" ? "Lien d'inscription créé" : "Code d'activation créé"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <output
          className={cx(
            "min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-ink select-all",
            kind === "code" ? "text-center font-mono text-2xl font-bold tracking-widest" : "text-sm break-all",
          )}
        >
          {value}
        </output>
        <CopyButton value={value} label={kind === "link" ? "Copier le lien" : "Copier le code"} />
      </div>
      <p className={cx("text-sm", info.ok ? "text-ink" : "font-medium text-danger")}>{info.text}</p>
      <p className="text-xs text-muted">
        Valable jusqu&apos;au {formatDate(expiresAt)}.
        {once && " Ce code ne sera plus affiché : notez-le ou transmettez-le maintenant."}
      </p>
    </div>
  );
}
