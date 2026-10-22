"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { LicenseRequestTable } from "@/components/admin/licences/license-request-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client-api";
import { DISCIPLINE_LABELS, currentSeason, seasonError } from "@/lib/documents";
import { missingFieldsText } from "@/lib/license-requests";
import type { Discipline, LicenseRequest, LicenseRequestsCreated } from "@/lib/types";

type Errors = Partial<Record<"season" | "disciplines", string>>;
type Outcome = { tone: "success" | "warning"; lines: string[] };

const disciplines = Object.keys(DISCIPLINE_LABELS) as Discipline[];

function list(items: Discipline[]): string {
  return items.map((discipline) => DISCIPLINE_LABELS[discipline]).join(", ");
}

function summary(result: LicenseRequestsCreated, season: string): Outcome {
  const lines: string[] = [];
  if (result.created.length > 0) {
    const plural = result.created.length > 1;
    lines.push(`${plural ? "Demandes enregistrées" : "Demande enregistrée"} pour ${season} : ${list(result.created.map((item) => item.discipline))}.`);
  }
  for (const discipline of result.skipped) {
    lines.push(`${DISCIPLINE_LABELS[discipline]} déjà demandée ou déjà licenciée pour ${season}.`);
  }
  return { tone: result.created.length > 0 ? "success" : "warning", lines };
}

export function MemberLicenseRequests({ memberId, requests }: { memberId: string; requests: LicenseRequest[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const open = requests.find((request) => request.status !== "DONE");
  const missing = open ? missingFieldsText(open.missingFields) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const season = String(data.get("season") ?? "").trim();
    const chosen = data.getAll("disciplines").map(String) as Discipline[];
    const note = String(data.get("note") ?? "").trim();
    const next: Errors = {
      season: seasonError(season),
      disciplines: chosen.length > 0 ? undefined : "Choisissez au moins une discipline.",
    };
    setErrors(next);
    setError(null);
    setOutcome(null);
    if (Object.values(next).some(Boolean)) return;

    setPending(true);
    const result = await apiRequest<LicenseRequestsCreated>("POST", "/admin/license-requests", {
      userId: memberId,
      season,
      disciplines: chosen,
      ...(note && { note }),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOutcome(summary(result.data, season));
    if (result.data.created.length > 0) setFormKey((key) => key + 1);
    router.refresh();
  }

  return (
    <Card
      title="Demandes de licence"
      description="À passer à la main sur l'extranet de la FFJDA. Déposer la licence ci-dessous clôt la demande de la discipline."
    >
      <div className="flex flex-col gap-6">
        {missing && <Notice tone="warning">{missing}. Complétez-le avant d&apos;envoyer la demande à la FFJDA.</Notice>}

        {requests.length === 0 ? (
          <p className="text-sm text-muted">Aucune demande de licence pour ce membre.</p>
        ) : (
          <LicenseRequestTable
            items={requests}
            caption="Demandes de licence du membre"
            showMember={false}
            onUpdated={() => router.refresh()}
            onDeleted={() => router.refresh()}
          />
        )}

        <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-line pt-6" noValidate>
          <h3 className="text-sm font-semibold text-ink">Demander une licence</h3>
          <Field id="license-request-season" label="Saison" hint="De septembre à août, par exemple 2026-2027." error={errors.season}>
            {(control) => (
              <Input {...control} name="season" defaultValue={currentSeason()} maxLength={9} inputMode="numeric" className="sm:max-w-48" />
            )}
          </Field>
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={errors.disciplines ? "license-request-disciplines-error" : undefined}
          >
            <legend className="mb-1.5 text-sm font-medium text-ink">Disciplines</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {disciplines.map((discipline) => (
                <label
                  key={discipline}
                  htmlFor={`license-request-${discipline}`}
                  className="flex min-h-11 items-center gap-2 text-sm text-ink sm:min-h-0"
                >
                  <input
                    id={`license-request-${discipline}`}
                    name="disciplines"
                    type="checkbox"
                    value={discipline}
                    className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  {DISCIPLINE_LABELS[discipline]}
                </label>
              ))}
            </div>
            {errors.disciplines && (
              <p id="license-request-disciplines-error" className="text-xs font-medium text-danger">
                {errors.disciplines}
              </p>
            )}
          </fieldset>
          <Field id="license-request-note" label="Note (facultatif)">
            {(control) => <Textarea {...control} name="note" maxLength={500} rows={2} />}
          </Field>
          <FormAlert message={error} />
          {outcome && (
            <Notice tone={outcome.tone} className="flex flex-col gap-1">
              {outcome.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </Notice>
          )}
          <Button type="submit" variant="secondary" loading={pending} className="self-start">
            Demander la licence
          </Button>
        </form>
      </div>
    </Card>
  );
}
