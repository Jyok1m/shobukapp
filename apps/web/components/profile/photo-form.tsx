"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { apiErrorMessages } from "@/lib/errors";
import { PhotoCropDialog } from "./photo-crop-dialog";

/* The picked file is only read in the browser: the upload is the crop (5 MB max, checked when exported). */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type PhotoFormProps = {
  userId: string;
  firstName: string;
  lastName: string;
  /* Changes on every upload: busts the five-minute browser cache of the photo. */
  photoVersion: string | null;
};

export function PhotoForm({ userId, firstName, lastName, photoVersion }: PhotoFormProps) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);

  const src = photoVersion
    ? `/api/members/${userId}/photo?v=${encodeURIComponent(photoVersion)}`
    : null;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    // Checked again by the API: this only saves a useless upload.
    if (!ACCEPTED.includes(file.type)) return setError(apiErrorMessages.unsupported_file_type);
    if (file.size > MAX_SOURCE_BYTES) return setError("Cette image est trop lourde. Choisissez une photo de moins de 40 Mo.");
    setCropError(null);
    setPicked(file);
  }

  async function upload(cropped: File) {
    const body = new FormData();
    body.append("file", cropped);
    setPending("upload");
    setCropError(null);
    const result = await apiRequest("POST", "/me/photo", body);
    setPending(null);
    if (!result.ok) return setCropError(result.error);
    toast.success("Photo enregistrée");
    setPicked(null);
    router.refresh();
  }

  async function onRemove() {
    setPending("remove");
    const result = await apiRequest("DELETE", "/me/photo");
    setPending(null);
    setConfirming(false);
    if (!result.ok) return setError(result.error);
    toast.success("Photo supprimée");
    router.refresh();
  }

  return (
    <Card title="Photo" description="JPEG, PNG ou WebP. Vous pourrez la recadrer avant de l'enregistrer.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <MemberAvatar firstName={firstName} lastName={lastName} src={src} size="lg" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={input}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onFile}
          />
          <Button variant="secondary" loading={pending === "upload"} disabled={pending !== null} onClick={() => input.current?.click()}>
            {src ? "Changer la photo" : "Ajouter une photo"}
          </Button>
          {src && (
            <Button variant="ghost" disabled={pending !== null} onClick={() => setConfirming(true)}>
              Supprimer la photo
            </Button>
          )}
        </div>
      </div>
      <FormAlert message={error} />
      <PhotoCropDialog
        file={picked}
        pending={pending === "upload"}
        error={cropError}
        onCancel={() => setPicked(null)}
        onConfirm={upload}
      />
      <ConfirmDialog
        open={confirming}
        title="Supprimer votre photo ?"
        description="Les autres membres verront vos initiales à la place."
        confirmLabel="Supprimer"
        pending={pending === "remove"}
        onConfirm={onRemove}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
