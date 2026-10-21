import Link from "next/link";
import { DojoContact } from "@/components/dojo-contact";
import { Logo } from "@/components/logo";
import { DojoSiteLink } from "@/components/dojo-site-link";
import { DOJO } from "@/lib/dojo";
import { buttonClasses } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-16 sm:px-6">
      <section className="flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Logo className="h-20 w-auto self-start text-ink sm:h-24" />
          <p className="text-sm font-medium tracking-widest text-accent uppercase">Espace membres</p>
          <h1 className="font-serif text-4xl font-bold text-ink sm:text-5xl">Shobukan Hombu Dojo</h1>
          <p className="text-sm font-medium text-ink">{DOJO.disciplines}</p>
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
        <div>
          <DojoSiteLink className="min-h-11 text-sm font-medium text-accent hover:underline sm:min-h-0" />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="contact-title">
        <h2 id="contact-title" className="font-serif text-2xl font-bold text-ink">
          Nous trouver
        </h2>
        <DojoContact className="text-sm text-muted" />
      </section>
    </div>
  );
}
