import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <>
      <RedirectIfSignedIn />
      <AuthPanel title="Connexion" description="Accédez à votre espace membre.">
        <LoginForm />
      </AuthPanel>
    </>
  );
}
