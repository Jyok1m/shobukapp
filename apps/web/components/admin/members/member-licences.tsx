"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Table, Td, Th } from "@/components/ui/table";
import { apiRequest } from "@/lib/client-api";
import { checkDocumentFile, currentSeason, documentUploadError } from "@/lib/documents";
import { formatShortDate } from "@/lib/format";
import type { License } from "@/lib/types";

type Errors = Partial<Record<"season" | "number" | "file", string>>;

function seasonError(season: string): string | undefined {
  const match = /^(\d{4})-(\d{4})$/.exec(season);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return "Format attendu : 2026-2027.";
  return undefined;
}

/* POST /admin/licenses upserts on member and season: the same season replaces the number and the file. */
export function MemberLicences({ memberId, licenses }: { memberId: string; licenses: License[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sorted = [...licenses].sort((a, b) => b.season.localeCompare(a.season));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const season = String(data.get("season") ?? "").trim();
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
    setSaved(null);
    if (Object.values(next).some(Boolean)) return;

    const body = new FormData();
    body.append("userId", memberId);
    body.append("season", season);
    body.append("number", number);
    if (hasFile) body.append("file", file);
    const replacing = licenses.some((license) => license.season === season);

    setPending(true);
    const result = await apiRequest<License>("POST", "/admin/licenses", body);
    setPending(false);
    if (!result.ok) return setError(documentUploadError(result));
    setSaved(replacing ? `Licence ${season} mise à jour.` : `Licence ${season} ajoutée.`);
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
    setDeleting(null);
    router.refresh();
  }

  return (
    <Card
      title="Licences FFK"
      description="Une licence par saison. Enregistrer une saison existante remplace son numéro, et son fichier si vous en joignez un."
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
                  <Td className="font-mono">{license.number}</Td>
                  <Td className="whitespace-nowrap">{formatShortDate(license.updatedAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      {license.hasFile ? (
                        <a
                          href={`/api/licenses/${license.id}/file`}
                          download
                          className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-accent hover:bg-ink/5"
                          aria-label={`Télécharger la licence ${license.season}`}
                        >
                          Télécharger
                        </a>
                      ) : (
                        <span className="px-3 text-sm whitespace-nowrap text-muted">Sans fichier</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(license);
                        }}
                        aria-label={`Supprimer la licence ${license.season}`}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" variant="secondary" loading={pending} className="self-start">
              Enregistrer la licence
            </Button>
            {saved && <Notice tone="success">{saved}</Notice>}
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Supprimer la licence ${deleting.season} ?` : "Supprimer la licence ?"}
        description="Le numéro et le fichier de cette saison seront définitivement supprimés."
        confirmLabel="Supprimer"
        pending={deletePending}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}
