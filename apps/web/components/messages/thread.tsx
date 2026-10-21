"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";
import { cx } from "@/lib/cx";
import { usePolling } from "@/lib/use-polling";
import type { Counterpart, Message, Thread as ThreadPage } from "@/lib/types";
import { Composer } from "./composer";
import { formatMessageDate, photoUrl } from "./format";

const THREAD_POLL_MS = 15_000;

type State =
  | { kind: "loading" }
  | { kind: "unreachable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; counterpart: Counterpart; canWrite: boolean };

/* Oldest first for display, without duplicates (polling overlaps the loaded page). */
function merge(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function cannotWriteReason(isSelf: boolean): string {
  return isSelf
    ? "Vous ne pouvez pas vous écrire à vous-même."
    : "Ce membre n'apparaît pas dans l'annuaire : vous pourrez lui répondre dès qu'il vous aura écrit.";
}

export function Thread({
  userId,
  currentUserId,
  onBack,
  onRead,
  onSent,
}: {
  userId: string;
  currentUserId: string;
  onBack: () => void;
  onRead: (userId: string) => void;
  onSent: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [olderPending, setOlderPending] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // How the next render of the messages should move the scroll position.
  const scrollIntent = useRef<{ mode: "bottom" } | { mode: "keep"; fromBottom: number } | { mode: "follow" }>({
    mode: "bottom",
  });

  const markRead = useCallback(
    async (items: Message[]) => {
      if (!items.some((message) => message.recipientId === currentUserId && !message.readAt)) return;
      const result = await apiRequest("POST", `/messages/with/${encodeURIComponent(userId)}/read`);
      if (result.ok) onRead(userId);
    },
    [currentUserId, onRead, userId],
  );

  const fetchLatest = useCallback(
    async (initial: boolean) => {
      const result = await apiRequest<ThreadPage>("GET", `/messages/with/${encodeURIComponent(userId)}`);
      if (!result.ok) {
        // 404 for an unknown member or one this user may not reach; 400 for a malformed id.
        if (result.status === 404 || result.status === 400) return setState({ kind: "unreachable" });
        if (initial) setState({ kind: "error", message: result.error });
        return;
      }
      const page = result.data;
      setState({ kind: "ready", counterpart: page.counterpart, canWrite: page.canWrite });
      scrollIntent.current = initial ? { mode: "bottom" } : { mode: "follow" };
      setMessages((current) => merge(initial ? [] : current, page.items));
      if (initial) setCursor(page.nextCursor);
      void markRead(page.items);
    },
    [markRead, userId],
  );

  useEffect(() => {
    // Initial load of the thread: the fetch then updates state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLatest(true);
  }, [fetchLatest]);

  usePolling(() => void fetchLatest(false), THREAD_POLL_MS, state.kind === "ready");

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const intent = scrollIntent.current;
    if (intent.mode === "bottom") element.scrollTop = element.scrollHeight;
    else if (intent.mode === "keep") element.scrollTop = element.scrollHeight - intent.fromBottom;
    else if (element.scrollHeight - element.scrollTop - element.clientHeight < 160) {
      element.scrollTop = element.scrollHeight;
    }
    scrollIntent.current = { mode: "follow" };
  }, [messages]);

  async function loadOlder() {
    if (!cursor) return;
    setOlderPending(true);
    setOlderError(null);
    const result = await apiRequest<ThreadPage>("GET", `/messages/with/${encodeURIComponent(userId)}?cursor=${encodeURIComponent(cursor)}`);
    setOlderPending(false);
    if (!result.ok) return setOlderError(result.error);
    const element = scroller.current;
    scrollIntent.current = { mode: "keep", fromBottom: element ? element.scrollHeight - element.scrollTop : 0 };
    setMessages((current) => merge(current, result.data.items));
    setCursor(result.data.nextCursor);
  }

  const back = (
    <Button variant="ghost" size="sm" onClick={onBack} className="lg:hidden">
      Retour
    </Button>
  );

  if (state.kind !== "ready") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-line p-3 lg:hidden">{back}</div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          {state.kind === "loading" ? (
            <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <p role="alert" className="max-w-sm text-sm text-muted">
              {state.kind === "unreachable" ? "Ce membre n'est pas joignable par la messagerie." : state.message}
            </p>
          )}
          {state.kind === "loading" && <span className="sr-only">Chargement de la conversation</span>}
        </div>
      </div>
    );
  }

  const { counterpart, canWrite } = state;
  const name = `${counterpart.firstName} ${counterpart.lastName}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line p-3">
        {back}
        <MemberAvatar firstName={counterpart.firstName} lastName={counterpart.lastName} src={photoUrl(counterpart)} />
        <h2 className="truncate font-serif text-lg font-semibold text-ink">{name}</h2>
        {counterpart.isAdmin && <Badge tone="accent">Admin</Badge>}
      </div>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {cursor && (
          <div className="flex flex-col items-center gap-2">
            <Button variant="secondary" size="sm" loading={olderPending} onClick={loadOlder}>
              Charger les messages précédents
            </Button>
            {olderError && <p className="text-xs text-danger">{olderError}</p>}
          </div>
        )}
        {messages.length === 0 && (
          <p className="m-auto text-sm text-muted">Aucun message pour l&apos;instant. Écrivez le premier.</p>
        )}
        <ol className="flex flex-col gap-3">
          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <li key={message.id} className={cx("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                {/* Plain text only: React escapes it, whitespace-pre-wrap keeps the line breaks. */}
                <p
                  className={cx(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap sm:max-w-[70%]",
                    mine ? "bg-accent text-white" : "border border-line bg-paper text-ink",
                  )}
                >
                  <span className="sr-only">{mine ? "Vous : " : `${counterpart.firstName} : `}</span>
                  {message.body}
                </p>
                <span className="text-xs text-muted">{formatMessageDate(message.createdAt)}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {canWrite ? (
        <Composer
          recipientId={counterpart.id}
          onSent={(message) => {
            scrollIntent.current = { mode: "bottom" };
            setMessages((current) => merge(current, [message]));
            onSent();
          }}
        />
      ) : (
        <p className="border-t border-line bg-paper p-4 text-sm text-muted">
          {cannotWriteReason(counterpart.id === currentUserId)}
        </p>
      )}
    </div>
  );
}
