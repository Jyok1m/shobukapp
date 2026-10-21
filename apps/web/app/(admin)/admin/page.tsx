import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import { cx } from "@/lib/cx";
import { requireUser } from "@/lib/session";
import type { AdminMembersPage, AdminPlan } from "@/lib/types";

export const metadata: Metadata = { title: "Administration" };

/* First page only (50 rows): beyond that the count reads "50+". A failed count hides the figure, not the card. */
async function countMembers(search: string): Promise<string | null> {
  try {
    const page = await apiGet<AdminMembersPage>(`/admin/members${search}`);
    return page.nextCursor ? `${page.items.length}+` : String(page.items.length);
  } catch (error) {
    // apiGet redirects on 401 by throwing: let that through.
    unstable_rethrow(error);
    return null;
  }
}

async function countActivePlans(): Promise<string | null> {
  try {
    const plans = await apiGet<AdminPlan[]>("/admin/plans");
    return String(plans.filter((plan) => plan.active).length);
  } catch (error) {
    // apiGet redirects on 401 by throwing: let that through.
    unstable_rethrow(error);
    return null;
  }
}

type Tile = {
  href: string | null;
  title: string;
  description: string;
  figure: string | null;
  figureLabel?: string;
  alert?: boolean;
};

function TileCard({ tile }: { tile: Tile }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-ink">{tile.title}</h2>
        {!tile.href && <Badge>Bientôt disponible</Badge>}
      </div>
      <p className="text-sm text-muted">{tile.description}</p>
      {tile.figure !== null && (
        <p className="mt-auto pt-2 text-sm">
          <span className={cx("text-2xl font-bold", tile.alert ? "text-danger" : "text-ink")}>{tile.figure}</span>{" "}
          <span className="text-muted">{tile.figureLabel}</span>
        </p>
      )}
    </>
  );
  const base = "flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6";
  if (!tile.href) return <div className={cx(base, "opacity-70")}>{body}</div>;
  return (
    <Link
      href={tile.href}
      className={cx(
        base,
        "transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {body}
    </Link>
  );
}

/*
 * A page renders in parallel with its layouts, so the layout redirect does not
 * keep the page out of the response: admin pages check the role themselves.
 */
async function AdminHome() {
  await requireUser("ADMIN");
  const [late, members, plans] = await Promise.all([
    countMembers("?status=past_due"),
    countMembers(""),
    countActivePlans(),
  ]);

  const tiles: Tile[] = [
    {
      href: "/admin/pratiquants",
      title: "Pratiquants",
      description: "Situation de paiement de chacun, relances.",
      figure: late,
      figureLabel: "en retard de paiement",
      alert: late !== null && late !== "0",
    },
    {
      href: "/admin/formules",
      title: "Formules",
      description: "Les cotisations proposées, synchronisées avec Stripe.",
      figure: plans,
      figureLabel: plans === "1" ? "formule active" : "formules actives",
    },
    {
      href: "/admin/membres",
      title: "Membres",
      description: "Fiches, coordonnées, export CSV.",
      figure: members,
      figureLabel: members === "1" ? "compte" : "comptes",
    },
    {
      href: "/admin/documents",
      title: "Documents du dojo",
      description: "Statuts, règlement intérieur, pièces comptables et autres documents du club.",
      figure: null,
    },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {tiles.map((tile) => (
        <li key={tile.title}>
          <TileCard tile={tile} />
        </li>
      ))}
    </ul>
  );
}

export default function AdminHomePage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Administration" description="Gestion du dojo, réservée aux administrateurs." />
      <Suspense fallback={<PageFallback />}>
        <AdminHome />
      </Suspense>
    </div>
  );
}
