import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreateMemberForm } from "@/components/admin/members/create-member-form";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Créer un membre" };

/* The layout redirect does not protect the page: it checks the role itself. */
async function NewMember() {
  await requireUser("ADMIN");
  return (
    <div className="max-w-3xl">
      <CreateMemberForm />
    </div>
  );
}

export default function NewMemberPage() {
  return (
    <div className="flex flex-col">
      <Link href="/admin/membres" className="mb-2 text-sm font-medium text-accent hover:underline">
        Retour aux membres
      </Link>
      <PageHeader title="Créer un membre" description="Un compte complet, avec un mot de passe provisoire à remettre en main propre." />
      <Suspense fallback={<PageFallback />}>
        <NewMember />
      </Suspense>
    </div>
  );
}
