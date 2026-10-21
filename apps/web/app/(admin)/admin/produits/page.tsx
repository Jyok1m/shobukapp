import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsList } from "@/components/admin/products-list";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { AdminProduct } from "@/lib/types";

export const metadata: Metadata = { title: "Produits" };

/* The layout redirect does not protect the page: it checks the role itself. */
async function Products() {
  await requireUser("ADMIN");
  const products = await apiGet<AdminProduct[]>("/admin/products");
  return <ProductsList products={products} />;
}

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Produits"
        description="Paiements ponctuels hors cotisation : licence-assurance FFJDA, passeport sportif, cours particuliers, pratiquants de passage. Changer un montant ne s'applique qu'aux nouveaux liens de paiement : un lien déjà envoyé garde le montant d'origine."
      />
      <Suspense fallback={<PageFallback />}>
        <Products />
      </Suspense>
    </div>
  );
}
