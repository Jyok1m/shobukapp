import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Inscription" };

export default function RegisterPage() {
  return (
    <>
      <RedirectIfSignedIn />
      <AuthPanel
        title="Inscription"
        description="Créez votre compte pour adhérer au dojo et gérer votre dossier."
      >
        <RegisterForm />
      </AuthPanel>
    </>
  );
}
