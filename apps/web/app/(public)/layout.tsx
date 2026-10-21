import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClasses } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Brand />
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <ThemeToggle compact />
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
      <footer className="flex flex-col items-center gap-2 border-t border-line px-4 py-6 text-center text-xs text-muted sm:flex-row sm:justify-center sm:gap-4">
        <span>Shobukan Dojo, club de kendo</span>
        <Link href="/confidentialite" className="inline-flex min-h-10 items-center underline-offset-2 hover:text-ink hover:underline sm:min-h-0">
          Confidentialité et cookies
        </Link>
      </footer>
    </div>
  );
}
