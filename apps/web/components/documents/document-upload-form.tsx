"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/client-api";
import { categoryLabels, checkDocumentFile, DOCUMENT_ACCEPT, documentUploadError } from "@/lib/documents";
import type { DocumentCategory } from "@/lib/types";

type Errors = Partial<Record<"file" | "title" | "validUntil", string>>;

/* POST /documents (member) or /admin/documents (dojo), multipart. */
export function DocumentUploadForm({
  endpoint,
  categories,
  title,
  description,
}: {
  endpoint: "/documents" | "/admin/documents";
  categories: DocumentCategory[];
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<DocumentCategory>(categories[0]);
  const [docTitle, setDocTitle] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  // Remounts the file input after a successful upload, which clears it.
  const [formKey, setFormKey] = useState(0);

  const withValidity = category === "MEDICAL_CERTIFICATE";

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSaved(false);
    if (!file) return;
    const problem = checkDocumentFile(file);
    setErrors((current) => ({ ...current, file: problem ?? undefined }));
    // A sensible default title, editable: the filename itself is never stored.
    if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    const validUntil = String(data.get("validUntil") ?? "");
    const next: Errors = {};
    if (!(file instanceof File) || file.size === 0) next.file = "Choisissez un fichier.";
    else next.file = checkDocumentFile(file) ?? undefined;
    if (!docTitle.trim()) next.title = "Donnez un titre au document.";
    if (withValidity && !validUntil) next.validUntil = "Indiquez la date de fin de validité du certificat.";
    setErrors(next);
    setError(null);
    setSaved(false);
    if (Object.values(next).some(Boolean)) return;

    const body = new FormData();
    body.append("file", file as File);
    body.append("title", docTitle.trim());
    body.append("category", category);
    if (withValidity) body.append("validUntil", validUntil);

    setPending(true);
    const result = await apiRequest("POST", endpoint, body);
    setPending(false);
    if (!result.ok) return setError(documentUploadError(result));
    setSaved(true);
    setDocTitle("");
    setFormKey((key) => key + 1);
    router.refresh();
  }

  return (
    <Card title={title} description={description}>
      <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.length > 1 && (
            <Field id="document-category" label="Type de document">
              {(control) => (
                <Select
                  {...control}
                  value={category}
                  onChange={(event) => setCategory(event.target.value as DocumentCategory)}
                >
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field id="document-file" label="Fichier" hint="PDF, JPEG, PNG ou WebP, 10 Mo maximum." error={errors.file}>
            {(control) => (
              <Input
                {...control}
                name="file"
                type="file"
                accept={DOCUMENT_ACCEPT}
                onChange={onFile}
                className="h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-ink/5 file:px-2 file:py-1 file:text-sm"
              />
            )}
          </Field>
          <Field id="document-title" label="Titre" error={errors.title}>
            {(control) => (
              <Input {...control} value={docTitle} onChange={(event) => setDocTitle(event.target.value)} maxLength={120} />
            )}
          </Field>
          {withValidity && (
            <Field
              id="document-valid-until"
              label="Valable jusqu'au"
              hint="La date figurant sur le certificat."
              error={errors.validUntil}
            >
              {(control) => <Input {...control} name="validUntil" type="date" />}
            </Field>
          )}
        </div>
        <FormAlert message={error} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" loading={pending} className="self-start">
            Envoyer le document
          </Button>
          {saved && <Notice tone="success">Document enregistré.</Notice>}
        </div>
      </form>
    </Card>
  );
}
