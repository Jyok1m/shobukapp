import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanCard, PlanGrid, PriceList } from "@/components/billing/plan-card";
import { buttonClasses } from "@/components/ui/button";
import { publicApiGet } from "@/lib/api";
import type { PublicPlan } from "@/lib/types";

/* Plans change from the admin screen: read at request time, never baked into the build. */
async function Plans() {
  await connection();
  const plans = await publicApiGet<PublicPlan[]>("/billing/plans").catch(() => null);
  if (!plans || plans.length === 0) {
    return (
      <p className="text-sm text-muted">
        Les formules seront bientôt disponibles. Écrivez-nous dès maintenant pour découvrir le dojo.
      </p>
    );
  }
  return (
    <PlanGrid>
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan}>
          <PriceList plan={plan} />
          <Link href="/nous-rejoindre" className={buttonClasses("primary", "md", "w-full")}>
            Nous rejoindre
          </Link>
        </PlanCard>
      ))}
    </PlanGrid>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-16 sm:px-6">
      <section className="flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">Espace membres</p>
          <h1 className="font-serif text-4xl font-bold text-ink sm:text-5xl">Shobukan Dojo</h1>
          <p className="max-w-xl text-lg text-muted">
            Votre adhésion, vos documents, vos licences et les autres pratiquants du dojo, réunis au même
            endroit. Écrivez-nous pour découvrir le dojo, puis choisissez votre formule et gardez votre dossier à jour.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/nous-rejoindre" className={buttonClasses("primary", "md", "h-11 px-6")}>
            Nous rejoindre
          </Link>
          <Link href="/connexion" className={buttonClasses("secondary", "md", "h-11 px-6")}>
            Connexion
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="plans-title">
        <div className="flex flex-col gap-1">
          <h2 id="plans-title" className="font-serif text-2xl font-bold text-ink">
            Nos formules
          </h2>
          <p className="text-sm text-muted">Une fois votre compte créé, réglez votre cotisation en ligne en toute sécurité.</p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">Chargement des formules…</p>}>
          <Plans />
        </Suspense>
      </section>
    </div>
  );
}
