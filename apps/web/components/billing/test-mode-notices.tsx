import { Notice } from "@/components/ui/notice";

/* Live mode, and the member's cotisation was paid in test mode: it is not carried over. */
export function NotCarriedNotice({ className }: { className?: string }) {
  return (
    <Notice tone="warning" className={className}>
      Le dojo est passé aux paiements réels. Votre cotisation de démonstration n&apos;est pas reprise : réglez votre
      cotisation pour rester à jour. Votre profil, vos documents et vos messages sont conservés.
    </Notice>
  );
}

/* Before any pay button in test mode: short line first, details right after. */
export function DemoPaymentNotice({
  className,
  subject = "cotisation",
}: {
  className?: string;
  /* "achat": one-off products (licence, private lessons...), nothing carries over either. */
  subject?: "cotisation" | "achat";
}) {
  return (
    <Notice tone="warning" className={className}>
      <p className="font-semibold">Mode démonstration : aucune somme n&apos;est débitée.</p>
      <p className="mt-1">
        Utilisez la carte <span className="font-mono whitespace-nowrap">4242 4242 4242 4242</span>, une date
        d&apos;expiration future et n&apos;importe quel code.
      </p>
      <p className="mt-1">
        {subject === "cotisation"
          ? "Cette cotisation de démonstration ne sera pas reprise quand le dojo passera aux paiements réels : il faudra alors la régler à nouveau."
          : "Ces achats de démonstration ne seront pas repris quand le dojo passera aux paiements réels."}
      </p>
    </Notice>
  );
}
