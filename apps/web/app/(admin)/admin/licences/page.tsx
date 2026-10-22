import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { LicenseRequestList } from "@/components/admin/licences/license-request-list";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { cx } from "@/lib/cx";
import { currentSeason, seasonError } from "@/lib/documents";
import {
  licenseRequestFilters,
  licenseRequestsExportUrl,
  licenseRequestsPath,
  parseLicenseRequestFilter,
} from "@/lib/license-requests";
import { requireUser } from "@/lib/session";
import type { LicenseRequestsPage } from "@/lib/types";

export const metadata: Metadata = { title: "Licences" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const path = "/admin/licences";

function pageHref(season: string, value: string | null): string {
  const params = new URLSearchParams({ saison: season });
  if (value) params.set("statut", value);
  return `${path}?${params}`;
}

/* The layout redirect does not protect the page: it checks the role itself. */
async function Requests({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("ADMIN");
  const params = await searchParams;
  const filter = parseLicenseRequestFilter(params.statut);
  const rawSeason = (Array.isArray(params.saison) ? params.saison[0] : params.saison)?.trim() ?? "";
  const invalidSeason = rawSeason !== "" && seasonError(rawSeason) !== undefined;
  const season = rawSeason && !invalidSeason ? rawSeason : currentSeason();
  const page = await apiGet<LicenseRequestsPage>(licenseRequestsPath({ season, status: filter.status }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Form action={path} className="flex flex-col gap-1.5">
          {filter.value && <input type="hidden" name="statut" value={filter.value} />}
          <label htmlFor="license-requests-season" className="text-sm font-medium text-ink">
            Saison
          </label>
          <div className="flex gap-2">
            <Input
              id="license-requests-season"
              name="saison"
              defaultValue={season}
              maxLength={9}
              inputMode="numeric"
              className="sm:w-36"
              aria-describedby={invalidSeason ? "license-requests-season-error" : undefined}
              aria-invalid={invalidSeason || undefined}
            />
            <Button type="submit" variant="secondary">
              Afficher
            </Button>
          </div>
          {invalidSeason && (
            <p id="license-requests-season-error" className="text-xs font-medium text-danger">
              Saison invalide (format attendu : 2026-2027) : la saison en cours est affichée.
            </p>
          )}
        </Form>
        <a href={licenseRequestsExportUrl(season)} download className={buttonClasses("secondary", "md", "self-start lg:self-auto")}>
          Exporter pour la FFJDA (CSV)
        </a>
      </div>

      <nav aria-label="Filtrer les demandes de licence">
        <ul className="flex flex-wrap gap-2">
          {licenseRequestFilters.map((item) => {
            const current = item.value === filter.value;
            return (
              <li key={item.label}>
                <Link
                  href={pageHref(season, item.value)}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-10 sm:min-h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    current ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:bg-paper",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Keyed on the query so "Charger plus" restarts from the new first page. */}
      <LicenseRequestList key={`${season}|${filter.label}`} initial={page} season={season} status={filter.status} />
    </div>
  );
}

export default function AdminLicenceRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Licences"
        description="Les licences FFJDA se demandent à la main sur l'extranet de la FFJDA. L'export CSV donne les informations de profil à y saisir pour les demandes à faire. Déposer la licence sur la fiche du membre clôt la demande."
      />
      <Suspense fallback={<PageFallback />}>
        <Requests searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
