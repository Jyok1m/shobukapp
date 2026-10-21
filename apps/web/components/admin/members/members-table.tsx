"use client";

import Link from "next/link";
import { FormAlert } from "@/components/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { formatShortDate } from "@/lib/format";
import type { AdminMembersPage } from "@/lib/types";
import { FederationBadges } from "./federation-badges";
import { fullName, type MemberQuery } from "./query";
import { useMemberPages } from "./use-member-pages";

export function MembersTable({ initial, query }: { initial: AdminMembersPage; query: MemberQuery }) {
  const { items, hasMore, pending, error, loadMore } = useMemberPages(initial, query);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucun membre"
        description={
          query.q ? "Aucun membre ne correspond à cette recherche." : "Les membres apparaîtront ici dès leur inscription."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <caption className="sr-only">Membres du dojo</caption>
        <thead>
          <tr>
            <Th>Nom</Th>
            <Th>Adresse e-mail</Th>
            <Th>Téléphone</Th>
            <Th>Inscription</Th>
            <Th>Licence et passeport</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((member) => {
            const name = fullName(member);
            return (
              <tr key={member.id}>
                <Td className="min-w-44">
                  <span className="font-medium">{name}</span>
                  {member.role === "ADMIN" && (
                    <Badge tone="accent" className="ml-2">
                      Admin
                    </Badge>
                  )}
                </Td>
                <Td className="max-w-64 truncate">
                  <a href={`mailto:${member.email}`} className="text-accent hover:underline">
                    {member.email}
                  </a>
                </Td>
                <Td className="whitespace-nowrap">{member.phone ?? <span className="text-muted">Non renseigné</span>}</Td>
                <Td className="whitespace-nowrap">{formatShortDate(member.createdAt)}</Td>
                <Td className="min-w-44">
                  <FederationBadges federation={member.federation} />
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Link
                      href={`/admin/membres/${member.id}`}
                      className="text-sm font-medium whitespace-nowrap text-accent hover:underline"
                      aria-label={`Voir la fiche de ${name}`}
                    >
                      Voir la fiche
                    </Link>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <FormAlert message={error} />
      {hasMore && (
        <Button variant="secondary" loading={pending} onClick={loadMore} className="self-center">
          Charger plus
        </Button>
      )}
    </div>
  );
}
