import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { JoinRequestForm } from "@/components/onboarding/join-request-form";

export const metadata: Metadata = { title: "Nous rejoindre" };

export default function JoinPage() {
  return (
    <>
      <RedirectIfSignedIn />
      <AuthPanel
        title="Nous rejoindre"
        description="Écrivez au bureau du dojo : nous vous répondons et, si vous nous rejoignez, vous recevez un lien pour créer votre compte."
      >
        <JoinRequestForm />
      </AuthPanel>
    </>
  );
}
