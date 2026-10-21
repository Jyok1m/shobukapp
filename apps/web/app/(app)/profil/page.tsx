import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { DirectoryToggle } from "@/components/profile/directory-toggle";
import { PasswordForm } from "@/components/profile/password-form";
import { PhotoForm } from "@/components/profile/photo-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { PageFallback } from "@/components/page-fallback";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Mon profil" };

async function Profile() {
  const user = await requireUser();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PhotoForm
        userId={user.id}
        firstName={user.firstName}
        lastName={user.lastName}
        photoVersion={user.photoKey}
      />
      <ProfileForm user={user} />
      <DirectoryToggle visible={user.directoryVisible} />
      <PasswordForm />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Mon profil"
        description="Vos coordonnées, les informations pour votre licence et votre présence dans l'annuaire."
      />
      <Suspense fallback={<PageFallback />}>
        <Profile />
      </Suspense>
    </div>
  );
}
