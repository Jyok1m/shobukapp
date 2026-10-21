import Link from "next/link";
import { Brand } from "@/components/brand";
import { DojoContact } from "@/components/dojo-contact";
import { DojoSiteLink } from "@/components/dojo-site-link";
import { DOJO } from "@/lib/dojo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Brand />
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <DojoSiteLink
              label="Site du dojo"
              className="hidden min-h-10 rounded-md px-3 text-sm font-medium text-ink hover:bg-ink/5 sm:inline-flex sm:min-h-8"
            />
            <nav aria-label="Accès membres" className="flex items-center gap-1 sm:gap-2">
              <Link href="/connexion" className={buttonClasses("ghost", "sm")}>
                Connexion
              </Link>
              <Link href="/nous-rejoindre" className={buttonClasses("primary", "sm")}>
                Nous rejoindre
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-line px-4 py-6 text-xs text-muted">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-ink">{DOJO.name}</span>
            <span>{DOJO.disciplines}</span>
          </div>
          <DojoContact compact className="items-center sm:items-start" />
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <DojoSiteLink className="min-h-10 font-medium text-accent hover:underline sm:min-h-0" />
            <Link href="/confidentialite" className="inline-flex min-h-10 items-center underline-offset-2 hover:text-ink hover:underline sm:min-h-0">
              Confidentialité et cookies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
