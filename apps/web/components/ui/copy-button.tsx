"use client";

import { useState } from "react";
import { Button } from "./button";

/* Copies `value` to the clipboard; the visible label confirms it for a few seconds. */
export function CopyButton({ value, label = "Copier" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {state === "copied" ? "Copié" : state === "failed" ? "Copie impossible, sélectionnez le texte" : label}
    </Button>
  );
}
