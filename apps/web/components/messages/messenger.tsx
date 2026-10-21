"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { cx } from "@/lib/cx";
import { notifyMessagesChanged, usePolling } from "@/lib/use-polling";
import type { Conversation } from "@/lib/types";
import { ConversationList } from "./conversation-list";
import { Thread } from "./thread";

const CONVERSATIONS_POLL_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * The open conversation lives in ?avec=<userId>. Selecting one pushes a history
 * entry without a server round trip (Next syncs useSearchParams with pushState),
 * so the browser back button returns to the list on mobile.
 */
export function Messenger({ initial, currentUserId }: { initial: Conversation[]; currentUserId: string }) {
  const searchParams = useSearchParams();
  // ?avec= ends up in /api paths: anything but a uuid (../, ?, #) is ignored.
  const requested = searchParams.get("avec");
  const selectedId = requested && UUID.test(requested) ? requested : null;
  const [conversations, setConversations] = useState(initial);

  const refresh = useCallback(async () => {
    const result = await apiRequest<Conversation[]>("GET", "/messages/conversations");
    if (result.ok) setConversations(result.data);
  }, []);

  usePolling(() => void refresh(), CONVERSATIONS_POLL_MS);

  const onRead = useCallback((userId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.counterpart.id === userId ? { ...conversation, unread: 0 } : conversation,
      ),
    );
    notifyMessagesChanged();
  }, []);

  const onSent = useCallback(() => {
    void refresh();
  }, [refresh]);

  function select(id: string | null) {
    window.history.pushState(null, "", id ? `/messagerie?avec=${encodeURIComponent(id)}` : "/messagerie");
  }

  return (
    <div className="grid min-h-112 flex-1 overflow-hidden rounded-lg border border-line bg-surface shadow-xs lg:h-[calc(100dvh-14rem)] lg:flex-none lg:grid-cols-[20rem_1fr]">
      <section
        aria-label="Conversations"
        className={cx("min-h-0 overflow-y-auto lg:block lg:border-r lg:border-line", selectedId ? "hidden" : "block")}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          currentUserId={currentUserId}
          onSelect={select}
        />
      </section>
      <section
        aria-label="Conversation"
        className={cx("min-h-0 h-[calc(100dvh-12rem)] lg:block lg:h-auto", selectedId ? "block" : "hidden")}
      >
        {selectedId ? (
          <Thread
            key={selectedId}
            userId={selectedId}
            currentUserId={currentUserId}
            onBack={() => select(null)}
            onRead={onRead}
            onSent={onSent}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            Choisissez une conversation, ou écrivez à un membre depuis l&apos;annuaire.
          </div>
        )}
      </section>
    </div>
  );
}
