import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <RedirectIfSignedIn />
      <AuthPanel
        title="Mot de passe oublié"
        description="Indiquez l'adresse e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      >
        <ForgotPasswordForm />
      </AuthPanel>
    </>
  );
}
