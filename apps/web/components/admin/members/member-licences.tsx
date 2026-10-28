"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { LicenseFileActions } from "@/components/documents/license-viewer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { DISCIPLINE_LABELS, checkDocumentFile, currentSeason, documentUploadError, seasonError } from "@/lib/documents";
import { formatShortDate } from "@/lib/format";
import type { Discipline, License } from "@/lib/types";

type Errors = Partial<Record<"season" | "number" | "file", string>>;

/* POST /admin/licenses upserts on member, season and discipline: the number is shared by the whole season, the file is per discipline. */
export function MemberLicences({ memberId, licenses }: { memberId: string; licenses: License[] }) {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sorted = [...licenses].sort((a, b) => b.season.localeCompare(a.season) || a.discipline.localeCompare(b.discipline));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const season = String(data.get("season") ?? "").trim();
    const discipline = String(data.get("discipline") ?? "") as Discipline;
    const number = String(data.get("number") ?? "").trim();
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const next: Errors = {
      season: seasonError(season),
      number: number ? undefined : "Indiquez le numéro de licence.",
      file: hasFile ? (checkDocumentFile(file) ?? undefined) : undefined,
    };
    setErrors(next);
    setError(null);
    if (Object.values(next).some(Boolean)) return;

    const body = new FormData();
    body.append("userId", memberId);
    body.append("season", season);
    body.append("discipline", discipline);
    body.append("number", number);
    if (hasFile) body.append("file", file);
    const replacing = licenses.some((license) => license.season === season && license.discipline === discipline);
    const label = `${DISCIPLINE_LABELS[discipline]} ${season}`;

    setPending(true);
    const result = await apiRequest<License>("POST", "/admin/licenses", body);
    setPending(false);
    if (!result.ok) return setError(documentUploadError(result));
    toast.success(replacing ? `Licence ${label} mise à jour` : `Licence ${label} ajoutée`);
    setFormKey((key) => key + 1);
    router.refresh();
  }

  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    const result = await apiRequest("DELETE", `/admin/licenses/${deleting.id}`);
    setDeletePending(false);
    if (!result.ok) return setDeleteError(result.error);
    toast.success(`Licence ${DISCIPLINE_LABELS[deleting.discipline]} ${deleting.season} supprimée`);
    setDeleting(null);
    router.refresh();
  }

  return (
    <Card
      title="Licences FFJDA"
      description="Un numéro par saison, un fichier par discipline. Changer le numéro d'une saison le change pour toutes ses disciplines."
    >
      <div className="flex flex-col gap-6">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">Aucune licence enregistrée pour ce membre.</p>
        ) : (
          <Table>
            <caption className="sr-only">Licences du membre</caption>
            <thead>
              <tr>
                <Th>Saison</Th>
                <Th>Discipline</Th>
                <Th>Numéro</Th>
                <Th>Mise à jour</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((license) => (
                <tr key={license.id}>
                  <Td className="font-medium whitespace-nowrap">{license.season}</Td>
                  <Td>{DISCIPLINE_LABELS[license.discipline]}</Td>
                  <Td className="font-mono">{license.number}</Td>
                  <Td className="whitespace-nowrap">{formatShortDate(license.updatedAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      {license.hasFile ? (
                        <LicenseFileActions license={license} />
                      ) : (
                        <span className="px-3 text-sm whitespace-nowrap text-muted">Sans fichier</span>
                      )}
                      <Button
                        variant="ghost-danger"
                        size="sm"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(license);
                        }}
                        aria-label={`Supprimer la licence ${DISCIPLINE_LABELS[license.discipline]} ${license.season}`}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <h3 className="text-sm font-semibold text-ink">Ajouter ou remplacer une licence</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="license-season" label="Saison" hint="De septembre à août, par exemple 2026-2027." error={errors.season}>
              {(control) => <Input {...control} name="season" defaultValue={currentSeason()} maxLength={9} inputMode="numeric" />}
            </Field>
            <Field id="license-discipline" label="Discipline">
              {(control) => (
                <Select {...control} name="discipline" defaultValue="KENDO">
                  {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="license-number" label="Numéro de licence" error={errors.number}>
              {(control) => <Input {...control} name="number" maxLength={40} autoComplete="off" />}
            </Field>
            <Field
              id="license-file"
              label="Fichier de la licence (facultatif)"
              hint="PDF, JPEG, PNG ou WebP, 10 Mo maximum."
              error={errors.file}
              className="sm:col-span-2"
            >
              {(control) => (
                <Input
                  {...control}
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-ink/5 file:px-2 file:py-1 file:text-sm"
                />
              )}
            </Field>
          </div>
          <FormAlert message={error} />
          <Button type="submit" variant="secondary" loading={pending} className="self-start">
            Enregistrer la licence
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Supprimer la licence ${DISCIPLINE_LABELS[deleting.discipline]} ${deleting.season} ?` : "Supprimer la licence ?"}
        description="Cette discipline et son fichier seront définitivement supprimés pour la saison."
        confirmLabel="Supprimer"
        pending={deletePending}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}
