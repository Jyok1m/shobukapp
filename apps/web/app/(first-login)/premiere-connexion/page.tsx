import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import { FirstPasswordForm } from "@/components/auth/first-password-form";
import { PageFallback } from "@/components/page-fallback";
import { requirePasswordChange } from "@/lib/session";

export const metadata: Metadata = { title: "Première connexion" };

async function FirstLogin() {
  const user = await requirePasswordChange();
  return (
    <AuthPanel
      title={`Bienvenue, ${user.firstName}`}
      description="Votre compte a été créé par le bureau du dojo avec un mot de passe provisoire. Choisissez maintenant votre propre mot de passe : il ne sera connu que de vous."
    >
      <FirstPasswordForm needsTerms={user.termsAcceptedAt === null} />
    </AuthPanel>
  );
}

export default function FirstLoginPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <FirstLogin />
    </Suspense>
  );
}
