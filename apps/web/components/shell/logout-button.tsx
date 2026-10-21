"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/auth/post-json";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    // An expired session answers 401: the user is signed out either way.
    await postJson("/auth/logout");
    router.push("/connexion");
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={onClick} className={className}>
      Se déconnecter
    </Button>
  );
}
