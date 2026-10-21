import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { AccountForm } from "@/components/onboarding/account-form";
import { PageFallback } from "@/components/page-fallback";
import { buttonClasses } from "@/components/ui/button";
import { getInvitationPreview } from "@/lib/api";
import type { InvitationPreview } from "@/lib/types";

export const metadata: Metadata = { title: "Inscription" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Choices() {
  return (
    <div className="flex flex-col gap-3">
      <Link href="/nous-rejoindre" className={buttonClasses("primary", "md", "w-full")}>
        Vous souhaitez découvrir le dojo
      </Link>
      <Link href="/activation" className={buttonClasses("secondary", "md", "w-full")}>
        Vous pratiquez déjà au dojo
      </Link>
    </div>
  );
}

async function Signup({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).invitation;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  if (!token) {
    return (
      <AuthPanel
        title="Inscription sur invitation"
        description="Les comptes sont créés à l'invitation du bureau du dojo, pour que chaque membre soit bien un pratiquant du club."
      >
        <Choices />
      </AuthPanel>
    );
  }

  const preview = await getInvitationPreview<InvitationPreview>(token);
  if (preview.kind === "busy") {
    return (
      <AuthPanel
        title="Trop de tentatives"
        description="Ce lien a été consulté trop souvent en peu de temps. Réessayez dans une minute."
      >
        <Choices />
      </AuthPanel>
    );
  }
  if (preview.kind === "invalid") {
    return (
      <AuthPanel
        title="Ce lien d'inscription n'est plus valable"
        description="Il a peut-être expiré, déjà servi, ou un lien plus récent vous a été envoyé. Seul le dernier lien reçu fonctionne."
      >
        <Choices />
      </AuthPanel>
    );
  }

  const invitation = preview.data;
  return (
    <AuthPanel
      title="Créer mon compte"
      description="Bienvenue au Shobukan Dojo. Vérifiez vos nom et prénom, puis choisissez votre mot de passe."
    >
      <AccountForm
        mode={{
          kind: "link",
          token,
          email: invitation.email,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
        }}
      />
    </AuthPanel>
  );
}

export default function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <RedirectIfSignedIn />
      <Suspense fallback={<PageFallback />}>
        <Signup searchParams={searchParams} />
      </Suspense>
    </>
  );
}
