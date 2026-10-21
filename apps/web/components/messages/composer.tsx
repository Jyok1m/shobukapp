"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client-api";
import type { Message } from "@/lib/types";

const MAX_LENGTH = 2000;

/* Enter sends, Shift+Enter adds a line. An IME composition never sends. */
export function Composer({ recipientId, onSent }: { recipientId: string; onSent: (message: Message) => void }) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = body.trim();

  async function send() {
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    const result = await apiRequest<Message>("POST", "/messages", { recipientId, body: trimmed });
    setPending(false);
    if (!result.ok) {
      setError(
        result.code === "member_not_found" ? "Ce membre n'est pas joignable par la messagerie." : result.error,
      );
      return;
    }
    setBody("");
    onSent(result.data);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-line p-3">
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor="message-body" className="sr-only">
          Votre message
        </label>
        <Textarea
          id="message-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_LENGTH}
          rows={2}
          placeholder="Écrire un message"
          aria-describedby="message-hint"
          className="max-h-40 min-h-11 resize-y"
        />
        <Button type="submit" loading={pending} disabled={!trimmed}>
          Envoyer
        </Button>
      </div>
      <p id="message-hint" className="flex justify-between gap-2 text-xs text-muted">
        <span>Entrée pour envoyer, Maj+Entrée pour aller à la ligne.</span>
        {body.length > MAX_LENGTH - 200 && (
          <span>
            {body.length} / {MAX_LENGTH}
          </span>
        )}
      </p>
    </form>
  );
}
