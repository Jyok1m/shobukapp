import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { JoinRequestActions } from "@/components/admin/onboarding/join-request-actions";
import { TrialScheduler } from "@/components/admin/onboarding/trial-scheduler";
import { PageFallback } from "@/components/page-fallback";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { invitationStatuses, joinRequestStatuses, trialBadge } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";
import type { JoinRequest } from "@/lib/types";

export const metadata: Metadata = { title: "Demande" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadRequest(id: string): Promise<JoinRequest> {
  if (!uuid.test(id)) notFound();
  const res = await apiFetch(`/admin/join-requests/${id}`);
  if (res.status === 401) redirect("/connexion");
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`GET /admin/join-requests/:id failed with status ${res.status}`);
  return (await res.json()) as JoinRequest;
}

/* The layout redirect does not protect the page: it checks the role itself. */
async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("ADMIN");
  const request = await loadRequest((await params).id);
  const state = joinRequestStatuses[request.status];
  const invitation = request.invitation;
  const trial = trialBadge(request);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/demandes" className="text-sm font-medium text-accent hover:underline">
          Retour aux demandes
        </Link>
        <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
          {request.firstName} {request.lastName}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Reçue le {formatDate(request.createdAt)}</span>
          <Badge tone={state.tone}>{state.label}</Badge>
          {trial && <Badge tone={trial.tone}>{trial.label}</Badge>}
        </div>
      </div>

      <Card title="Message">
        {/* Plain text from a public form: React escapes it, whitespace-pre-wrap keeps the line breaks. */}
        <p className="text-sm break-words whitespace-pre-wrap text-ink">{request.message}</p>
      </Card>

      <Card title="Contact">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <dt className="text-muted">Adresse e-mail</dt>
          <dd className="sm:col-span-3">
            <a href={`mailto:${request.email}`} className="break-all text-accent hover:underline">
              {request.email}
            </a>
          </dd>
          <dt className="text-muted">Téléphone</dt>
          <dd className="sm:col-span-3">
            {request.phone ? (
              <a href={`tel:${request.phone.replace(/\s+/g, "")}`} className="text-accent hover:underline">
                {request.phone}
              </a>
            ) : (
              <span className="text-muted">Non renseigné</span>
            )}
          </dd>
          <dt className="text-muted">Traitée</dt>
          <dd className="sm:col-span-3">
            {request.handledAt
              ? `Le ${formatDate(request.handledAt)}${request.handledBy ? `, par ${request.handledBy.firstName} ${request.handledBy.lastName}` : ""}`
              : "Pas encore"}
          </dd>
          <dt className="text-muted">Lien d&apos;inscription</dt>
          <dd className="flex flex-wrap items-center gap-2 sm:col-span-3">
            {invitation ? (
              <>
                <Badge tone={invitationStatuses[invitation.status].tone}>
                  {invitationStatuses[invitation.status].label}
                </Badge>
                <span className="text-muted">
                  envoyé le {formatDate(invitation.createdAt)}, valable jusqu&apos;au {formatDate(invitation.expiresAt)}
                </span>
              </>
            ) : (
              <span className="text-muted">Aucun lien envoyé</span>
            )}
          </dd>
        </dl>
      </Card>

      {request.wantsTrial && (
        <Card title="Cours d'essai">
          <TrialScheduler request={request} />
        </Card>
      )}

      <Card title="Actions">
        <JoinRequestActions request={request} />
      </Card>
    </div>
  );
}

export default function AdminJoinRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <RequestDetail params={params} />
    </Suspense>
  );
}
