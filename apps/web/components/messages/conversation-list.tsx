"use client";

import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/lib/cx";
import type { Conversation } from "@/lib/types";
import { formatListDate, photoUrl } from "./format";

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="p-4 text-sm text-muted">
        Aucune conversation pour l&apos;instant. Écrivez à un membre depuis l&apos;annuaire.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line">
      {conversations.map(({ counterpart, lastMessage, unread }) => {
        const name = `${counterpart.firstName} ${counterpart.lastName}`;
        const selected = counterpart.id === selectedId;
        const mine = lastMessage.senderId === currentUserId;
        return (
          <li key={counterpart.id}>
            <button
              type="button"
              onClick={() => onSelect(counterpart.id)}
              aria-current={selected ? "true" : undefined}
              className={cx(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                selected ? "bg-accent-soft" : "hover:bg-ink/5",
              )}
            >
              <MemberAvatar firstName={counterpart.firstName} lastName={counterpart.lastName} src={photoUrl(counterpart)} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className={cx("truncate text-sm text-ink", unread > 0 ? "font-semibold" : "font-medium")}>
                    {name}
                  </span>
                  {counterpart.isAdmin && <Badge tone="accent">Admin</Badge>}
                  <span className="ml-auto shrink-0 text-xs text-muted">{formatListDate(lastMessage.createdAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={cx("truncate text-sm", unread > 0 ? "text-ink" : "text-muted")}>
                    {mine && "Vous : "}
                    {lastMessage.body}
                  </span>
                  {unread > 0 && (
                    <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
                      {unread}
                      <span className="sr-only"> message{unread > 1 ? "s" : ""} non lu{unread > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
