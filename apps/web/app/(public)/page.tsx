import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium tracking-widest text-accent uppercase">Espace membres</p>
        <h1 className="font-serif text-4xl font-bold text-ink sm:text-5xl">Shobukan Dojo</h1>
        <p className="max-w-xl text-lg text-muted">
          Votre adhésion, vos documents, vos licences et les autres pratiquants du dojo, réunis au
          même endroit. Inscrivez-vous, choisissez votre formule et gardez votre dossier à jour.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/inscription" className={buttonClasses("primary", "md", "h-11 px-6")}>
          Inscription
        </Link>
        <Link href="/connexion" className={buttonClasses("secondary", "md", "h-11 px-6")}>
          Connexion
        </Link>
      </div>
    </section>
  );
}
