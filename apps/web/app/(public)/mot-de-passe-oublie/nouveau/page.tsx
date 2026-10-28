import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PageFallback } from "@/components/page-fallback";
import { buttonClasses } from "@/components/ui/button";

/* The token is in the URL: never hand it to another site through the Referer header. */
export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "no-referrer" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Reset({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  if (!/^[\w-]{43}$/.test(token)) {
    return (
      <AuthPanel
        title="Lien incomplet"
        description="Ce lien de réinitialisation est incomplet. Ouvrez-le directement depuis l'e-mail reçu, ou demandez-en un nouveau."
      >
        <Link href="/mot-de-passe-oublie" className={buttonClasses("primary", "md", "w-full")}>
          Demander un nouveau lien
        </Link>
      </AuthPanel>
    );
  }
  return (
    <AuthPanel
      title="Nouveau mot de passe"
      description="Choisissez votre nouveau mot de passe. Vos appareils seront déconnectés et vous pourrez vous reconnecter aussitôt."
    >
      <ResetPasswordForm token={token} />
    </AuthPanel>
  );
}

export default function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Reset searchParams={searchParams} />
    </Suspense>
  );
}
