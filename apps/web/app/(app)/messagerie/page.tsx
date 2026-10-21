import type { Metadata } from "next";
import { Suspense } from "react";
import { Messenger } from "@/components/messages/messenger";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { Conversation } from "@/lib/types";

export const metadata: Metadata = { title: "Messagerie" };

async function Messages() {
  const user = await requireUser();
  const conversations = await apiGet<Conversation[]>("/messages/conversations");
  return <Messenger initial={conversations} currentUserId={user.id} />;
}

export default function MessageriePage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Messagerie" description="Échanges privés entre membres du dojo." />
      <Suspense fallback={<PageFallback />}>
        <Messages />
      </Suspense>
    </div>
  );
}
