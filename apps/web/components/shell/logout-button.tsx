"use client";

import { useState } from "react";
import { postJson } from "@/components/auth/post-json";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    // An expired session answers 401: the user is signed out either way.
    await postJson("/auth/logout");
    /*
     * A full load, not a router push: it drops the client router cache and every
     * kept component state. Older history entries remain, but member pages are
     * dynamic (no-store), so going back asks the server, which redirects.
     */
    window.location.replace("/connexion");
  }

  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={onClick} className={className}>
      Se déconnecter
    </Button>
  );
}
