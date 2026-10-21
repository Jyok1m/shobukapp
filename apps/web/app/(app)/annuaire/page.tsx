import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MemberGrid } from "@/components/directory/member-grid";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { DirectoryPage } from "@/lib/types";

export const metadata: Metadata = { title: "Annuaire" };

async function Directory() {
  const user = await requireUser();
  const page = await apiGet<DirectoryPage>("/members");
  return (
    <>
      {!user.directoryVisible && (
        <p className="mb-6 text-sm text-muted">
          Vous n&apos;apparaissez pas dans l&apos;annuaire.{" "}
          <Link href="/profil" className="font-medium text-accent hover:underline">
            Modifier ce choix dans mon profil
          </Link>
        </p>
      )}
      <MemberGrid initial={page} currentUserId={user.id} />
    </>
  );
}

export default function AnnuairePage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Annuaire"
        description="Les membres du dojo qui ont choisi de partager leurs coordonnées."
      />
      <Suspense fallback={<PageFallback />}>
        <Directory />
      </Suspense>
    </div>
  );
}
