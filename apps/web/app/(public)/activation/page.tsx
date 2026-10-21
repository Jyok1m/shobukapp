import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { AccountForm } from "@/components/onboarding/account-form";

export const metadata: Metadata = { title: "Activer mon compte" };

export default function ActivationPage() {
  return (
    <>
      <RedirectIfSignedIn />
      <AuthPanel
        title="Activer mon compte"
        description="Vous pratiquez déjà au dojo : saisissez le code d'activation reçu du bureau par e-mail."
      >
        <AccountForm mode={{ kind: "code" }} />
      </AuthPanel>
    </>
  );
}
