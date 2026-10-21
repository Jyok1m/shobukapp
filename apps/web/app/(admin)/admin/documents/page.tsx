import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { categoryLabels } from "@/lib/documents";
import { requireUser } from "@/lib/session";
import type { DocumentCategory, MemberDocument } from "@/lib/types";

export const metadata: Metadata = { title: "Documents du dojo" };

const groups: DocumentCategory[] = ["LEGAL", "RULES", "ACCOUNTING", "OTHER"];

/* The layout redirect does not protect the page: it checks the role itself. */
async function DojoDocuments() {
  await requireUser("ADMIN");
  const documents = await apiGet<MemberDocument[]>("/admin/documents");
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <DocumentUploadForm
        endpoint="/admin/documents"
        categories={groups}
        title="Ajouter un document"
        description="Privé par défaut. Publiez-le sur le panneau d'annonces ou dans les documents importants pour le montrer aux membres."
        withPlacement
      />
      {groups.map((category) => {
        const items = documents.filter((document) => document.category === category);
        const id = `documents-${category.toLowerCase()}`;
        return (
          <section key={category} className="flex flex-col gap-4" aria-labelledby={id}>
            <h2 id={id} className="font-serif text-xl font-semibold text-ink">
              {categoryLabels[category]}
            </h2>
            <DocumentList
              documents={items}
              editable
              showCategory={false}
              showValidity={false}
              withPlacement
              caption={`Documents du dojo : ${categoryLabels[category]}`}
              emptyTitle="Aucun document dans cette catégorie"
            />
          </section>
        );
      })}
    </div>
  );
}

export default function AdminDocumentsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Documents du dojo"
        description="Statuts, règlement intérieur, pièces comptables et autres documents du club, à garder privés ou à publier pour les membres."
      />
      <Suspense fallback={<PageFallback />}>
        <DojoDocuments />
      </Suspense>
    </div>
  );
}
