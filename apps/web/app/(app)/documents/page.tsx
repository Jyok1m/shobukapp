import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { Notice } from "@/components/ui/notice";
import { apiGet } from "@/lib/api";
import { isExpired } from "@/lib/documents";
import { requireUser } from "@/lib/session";
import type { MemberDocument } from "@/lib/types";

export const metadata: Metadata = { title: "Mes documents" };

async function Documents() {
  await requireUser();
  const documents = await apiGet<MemberDocument[]>("/documents");
  const certificates = documents.filter((document) => document.category === "MEDICAL_CERTIFICATE");
  const hasValidCertificate = certificates.some(
    (certificate) => !certificate.validUntil || !isExpired(certificate.validUntil),
  );

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      {certificates.length > 0 && !hasValidCertificate && (
        <Notice tone="danger">
          Votre certificat médical a expiré. Ajoutez un certificat à jour pour continuer à pratiquer.
        </Notice>
      )}
      <DocumentUploadForm
        endpoint="/documents"
        categories={["MEDICAL_CERTIFICATE", "OTHER"]}
        title="Ajouter un document"
        description="Certificat médical, autorisation parentale ou tout document demandé par le dojo."
      />
      <section className="flex flex-col gap-4" aria-labelledby="documents-title">
        <h2 id="documents-title" className="font-serif text-xl font-semibold text-ink">
          Mes documents
        </h2>
        <DocumentList
          documents={documents}
          editable
          caption="Mes documents"
          emptyTitle="Aucun document"
          emptyDescription="Ajoutez votre certificat médical ci-dessus : le dojo en a besoin pour votre licence."
        />
      </section>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Mes documents"
        description="Visibles uniquement par vous et les administrateurs du dojo. Jamais partagés dans l'annuaire."
      />
      <Suspense fallback={<PageFallback />}>
        <Documents />
      </Suspense>
    </div>
  );
}
