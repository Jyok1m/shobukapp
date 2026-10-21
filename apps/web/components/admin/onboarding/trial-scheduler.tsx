"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { notifyJoinRequestsChanged } from "@/components/shell/use-join-request-count";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";
import { cx } from "@/lib/cx";
import { DEFAULT_TRIAL_TIME } from "@/lib/dojo";
import { trialDeliveryMessage } from "@/lib/onboarding";
import { formatTrialDay, formatTrialSlot, isOpenDay, parisIso, parisTime, parisToday, parisYmd } from "@/lib/trial";
import type { JoinRequest, MailDelivery, TrialScheduleResult } from "@/lib/types";

const OTHER = "other";

/* Proposed evenings, and the slot the admin confirms (POST /admin/join-requests/:id/trial). */
export function TrialScheduler({ request }: { request: JoinRequest }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const today = parisToday(now);
  const proposed = request.trialDates.map((date) => date.slice(0, 10));
  const upcoming = proposed.filter((ymd) => ymd >= today);

  const [scheduledAt, setScheduledAt] = useState(request.trialScheduledAt);
  const [editing, setEditing] = useState(request.trialScheduledAt === null);
  const [delivery, setDelivery] = useState<MailDelivery | null>(null);
  const scheduledDay = scheduledAt ? parisYmd(scheduledAt) : null;
  const [choice, setChoice] = useState(() =>
    scheduledDay && upcoming.includes(scheduledDay) ? scheduledDay : scheduledDay ? OTHER : (upcoming[0] ?? OTHER),
  );
  const [otherDate, setOtherDate] = useState(scheduledDay && !upcoming.includes(scheduledDay) ? scheduledDay : "");
  const [time, setTime] = useState(scheduledAt ? parisTime(scheduledAt) : DEFAULT_TRIAL_TIME);
  const [fieldErrors, setFieldErrors] = useState<{ date?: string; time?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ymd = choice === OTHER ? otherDate : choice;
    const next: { date?: string; time?: string } = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) next.date = "Choisissez une date.";
    else if (!isOpenDay(ymd)) next.date = "Le dojo est ouvert le lundi, le mercredi et le vendredi : choisissez un de ces jours.";
    if (!/^\d{2}:\d{2}$/.test(time)) next.time = "Indiquez une heure, par exemple 19:30.";
    if (!next.date && !next.time && Date.parse(parisIso(ymd, time)) <= Date.now()) {
      next.date = "Cette date est passée : choisissez un soir à venir.";
    }
    setFieldErrors(next);
    setError(null);
    if (next.date || next.time) return;

    setPending(true);
    const result = await apiRequest<TrialScheduleResult>("POST", `/admin/join-requests/${request.id}/trial`, {
      scheduledAt: parisIso(ymd, time),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setScheduledAt(result.data.trialScheduledAt);
    setDelivery(result.data.delivery);
    setEditing(false);
    notifyJoinRequestsChanged();
    router.refresh();
  }

  const info = delivery ? trialDeliveryMessage(delivery) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">Soirs proposés</h3>
        {proposed.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {proposed.map((ymd) => (
              <li key={ymd} className={cx(ymd < today && "text-muted")}>
                <span className="first-letter:uppercase">{formatTrialDay(ymd)}</span>
                {ymd < today && " (passé)"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucun soir proposé : convenez d&apos;une date avec la personne.</p>
        )}
      </div>

      {scheduledAt && !editing && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success-soft p-4">
          <p className="text-sm font-semibold text-success">Essai confirmé le {formatTrialSlot(scheduledAt)}</p>
          {info && <p className={cx("text-sm", info.ok ? "text-ink" : "font-medium text-danger")}>{info.text}</p>}
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setEditing(true)}>
            Modifier l&apos;essai
          </Button>
        </div>
      )}

      {editing && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-1" aria-describedby={fieldErrors.date ? "trial-date-error" : undefined}>
            <legend className="mb-1 text-sm font-medium text-ink">Soir de l&apos;essai</legend>
            {upcoming.map((ymd) => (
              <Choice key={ymd} value={ymd} checked={choice === ymd} onChange={setChoice}>
                <span className="first-letter:uppercase">{formatTrialDay(ymd)}</span>
              </Choice>
            ))}
            <Choice value={OTHER} checked={choice === OTHER} onChange={setChoice}>
              Une autre date
            </Choice>
            {choice === OTHER && (
              <div className="mt-1 pl-7">
                <label htmlFor="trial-other-date" className="sr-only">
                  Autre date (lundi, mercredi ou vendredi)
                </label>
                <Input
                  id="trial-other-date"
                  type="date"
                  min={today}
                  value={otherDate}
                  onChange={(event) => setOtherDate(event.target.value)}
                  aria-describedby="trial-other-date-hint"
                  className="sm:w-48"
                />
                <p id="trial-other-date-hint" className="mt-1 text-xs text-muted">
                  Un lundi, un mercredi ou un vendredi.
                </p>
              </div>
            )}
            {fieldErrors.date && (
              <p id="trial-date-error" className="text-xs font-medium text-danger">
                {fieldErrors.date}
              </p>
            )}
          </fieldset>
          <Field id="trial-time" label="Heure" error={fieldErrors.time} className="sm:w-48">
            {(control) => <Input {...control} type="time" value={time} onChange={(event) => setTime(event.target.value)} required />}
          </Field>
          <FormAlert message={error} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" loading={pending}>
              {scheduledAt ? "Modifier l'essai" : "Confirmer l'essai"}
            </Button>
            {scheduledAt && (
              <Button variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
                Annuler
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">La personne reçoit un e-mail avec la date, l&apos;heure et l&apos;adresse du dojo.</p>
        </form>
      )}

      <p className="border-t border-line pt-4 text-sm text-muted">
        Vous pouvez aussi simplement lui répondre par e-mail :{" "}
        <a href={`mailto:${request.email}`} className="font-medium break-all text-accent hover:underline">
          {request.email}
        </a>
      </p>
    </div>
  );
}

function Choice({
  value,
  checked,
  onChange,
  children,
}: {
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = `trial-choice-${value}`;
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm text-ink sm:min-h-9">
      <input
        id={id}
        type="radio"
        name="trial-choice"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {children}
    </label>
  );
}
