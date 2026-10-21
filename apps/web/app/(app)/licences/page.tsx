import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
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
        description="Le dojo dépose ici votre licence FFK chaque saison, une fois votre inscription validée. Vérifiez que votre profil est complet : il sert à la demande de licence."
      />
    );
  }
  const sorted = [...licenses].sort((a, b) => b.season.localeCompare(a.season));
  return (
    <div className="max-w-3xl">
      <Table>
        <caption className="sr-only">Mes licences FFK par saison</caption>
        <thead>
          <tr>
            <Th>Saison</Th>
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
              <Td className="font-mono">{license.number}</Td>
              <Td className="whitespace-nowrap">{formatShortDate(license.updatedAt)}</Td>
              <Td>
                <div className="flex justify-end">
                  {license.hasFile ? (
                    <a
                      href={`/api/licenses/${license.id}/file`}
                      download
                      className="text-sm font-medium whitespace-nowrap text-accent hover:underline"
                      aria-label={`Télécharger la licence ${license.season}`}
                    >
                      Télécharger
                    </a>
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
      <PageHeader title="Mes licences" description="Vos licences FFK, saison par saison, déposées par le dojo." />
      <Suspense fallback={<PageFallback />}>
        <Licences />
      </Suspense>
    </div>
  );
}
