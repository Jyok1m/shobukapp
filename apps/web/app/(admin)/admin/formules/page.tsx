import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanCreateForm } from "@/components/admin/plan-create-form";
import { PlansTable } from "@/components/admin/plans-table";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { AdminPlan } from "@/lib/types";

export const metadata: Metadata = { title: "Formules" };

/* The layout redirect does not protect the page: it checks the role itself. */
async function Plans() {
  await requireUser("ADMIN");
  const plans = await apiGet<AdminPlan[]>("/admin/plans");
  return (
    <div className="flex flex-col gap-8">
      <PlanCreateForm />
      <section className="flex flex-col gap-4" aria-labelledby="plans-title">
        <h2 id="plans-title" className="font-serif text-xl font-semibold text-ink">
          Toutes les formules
        </h2>
        <PlansTable plans={plans} />
      </section>
    </div>
  );
}

export default function AdminPlansPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Formules"
        description="Les cotisations proposées aux pratiquants, synchronisées avec Stripe."
      />
      <Suspense fallback={<PageFallback />}>
        <Plans />
      </Suspense>
    </div>
  );
}
