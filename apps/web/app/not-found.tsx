import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Brand href="/" />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">Page introuvable</h1>
        <p className="text-sm text-muted">
          Cette page n&apos;existe pas ou plus. L&apos;élément que vous cherchez a peut-être été supprimé.
        </p>
      </div>
      <Link href="/tableau-de-bord" className={buttonClasses("primary")}>
        Retour au tableau de bord
      </Link>
    </main>
  );
}
