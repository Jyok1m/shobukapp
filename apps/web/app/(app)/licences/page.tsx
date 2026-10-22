import type { Metadata } from "next";
import { Suspense } from "react";
import { LicenseFileActions } from "@/components/documents/license-viewer";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { DISCIPLINE_LABELS } from "@/lib/documents";
import { formatShortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { License } from "@/lib/types";

export const metadata: Metadata = { title: "Mes licences" };

async function Licences() {
  await requireUser();
  const licenses = await apiGet<License[]>("/licenses");
  if (licenses.length === 0) {
    return (
      <EmptyState
        title="Aucune licence pour l'instant"
        description="Le dojo dépose ici votre licence FFJDA chaque saison, une fois votre inscription validée. Vérifiez que votre profil est complet : il sert à la demande de licence."
      />
    );
  }
  const sorted = [...licenses].sort((a, b) => b.season.localeCompare(a.season) || a.discipline.localeCompare(b.discipline));
  return (
    <div className="max-w-3xl">
      <Table>
        <caption className="sr-only">Mes licences FFJDA par saison</caption>
        <thead>
          <tr>
            <Th>Saison</Th>
            <Th>Discipline</Th>
            <Th>Numéro de licence</Th>
            <Th>Mise à jour</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((license) => (
            <tr key={license.id}>
              <Td className="font-medium whitespace-nowrap">{license.season.replace("-", " / ")}</Td>
              <Td>{DISCIPLINE_LABELS[license.discipline]}</Td>
              <Td className="font-mono">{license.number}</Td>
              <Td className="whitespace-nowrap">{formatShortDate(license.updatedAt)}</Td>
              <Td>
                <div className="flex items-center justify-end gap-2">
                  {license.hasFile ? (
                    <LicenseFileActions license={license} />
                  ) : (
                    <span className="text-sm text-muted">Fichier non déposé</span>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default function LicencesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Mes licences" description="Vos licences FFJDA, saison par saison et par discipline, déposées par le dojo." />
      <Suspense fallback={<PageFallback />}>
        <Licences />
      </Suspense>
    </div>
  );
}
