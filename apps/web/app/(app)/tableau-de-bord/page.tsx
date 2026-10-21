import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tableau de bord" };

async function Greeting() {
  const user = await requireUser();
  return (
    <PageHeader
      title={`Bonjour ${user.firstName}`}
      description="Bienvenue dans votre espace membre du Shobukan Dojo."
    />
  );
}

const nextSteps = [
  { href: "/profil", title: "Compléter mon profil", text: "Coordonnées et informations pour la licence FFK." },
  { href: "/abonnement", title: "Choisir ma formule", text: "Adhérez au dojo et réglez votre cotisation." },
  { href: "/documents", title: "Déposer mon certificat médical", text: "Indispensable pour pratiquer." },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <Suspense fallback={<PageHeader title="Bonjour" />}>
        <Greeting />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-3">
        {nextSteps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Card title={step.title} className="h-full transition-colors hover:border-accent/40">
              <p className="text-sm text-muted">{step.text}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
