"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { MemberAvatar } from "@/components/member-avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/client-api";
import type { DirectoryMember, DirectoryPage } from "@/lib/types";

function MemberCard({ member, isSelf }: { member: DirectoryMember; isSelf: boolean }) {
  const name = `${member.firstName} ${member.lastName}`;
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <MemberAvatar
          firstName={member.firstName}
          lastName={member.lastName}
          src={member.hasPhoto ? `/api/members/${member.id}/photo` : null}
        />
        <p className="min-w-0 font-medium text-ink">
          <span className="block truncate">{name}</span>
          {isSelf && <span className="text-xs font-normal text-muted">C&apos;est vous</span>}
        </p>
      </div>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="sr-only">Téléphone</dt>
          <dd className="min-w-0 truncate">
            {member.phone ? (
              <a href={`tel:${member.phone.replace(/\s+/g, "")}`} className="text-accent hover:underline">
                {member.phone}
              </a>
            ) : (
              <span className="text-muted">Téléphone non renseigné</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Adresse e-mail</dt>
          <dd className="min-w-0 truncate">
            <a href={`mailto:${member.email}`} className="text-accent hover:underline">
              {member.email}
            </a>
          </dd>
        </div>
      </dl>
      {!isSelf && (
        <Link
          href={`/messagerie?avec=${member.id}`}
          className={buttonClasses("secondary", "sm", "mt-auto self-start")}
          aria-label={`Envoyer un message à ${name}`}
        >
          Envoyer un message
        </Link>
      )}
    </li>
  );
}

export function MemberGrid({ initial, currentUserId }: { initial: DirectoryPage; currentUserId: string }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    const result = await apiRequest<DirectoryPage>("GET", `/members?cursor=${encodeURIComponent(cursor)}`);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setItems((current) => [...current, ...result.data.items]);
    setCursor(result.data.nextCursor);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="L'annuaire est vide pour l'instant"
        description="Aucun membre n'a encore choisi d'y apparaître. Vous pouvez être le premier depuis votre profil."
        action={
          <Link href="/profil" className={buttonClasses("secondary", "sm")}>
            Mon profil
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((member) => (
          <MemberCard key={member.id} member={member} isSelf={member.id === currentUserId} />
        ))}
      </ul>
      <FormAlert message={error} />
      {cursor && (
        <Button variant="secondary" loading={pending} onClick={loadMore} className="self-center">
          Charger plus
        </Button>
      )}
    </div>
  );
}
