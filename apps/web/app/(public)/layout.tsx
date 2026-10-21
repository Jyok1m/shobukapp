import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonClasses } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand />
          <nav aria-label="Accès membres" className="flex items-center gap-1 sm:gap-2">
            <Link href="/connexion" className={buttonClasses("ghost", "sm")}>
              Connexion
            </Link>
            <Link href="/nous-rejoindre" className={buttonClasses("primary", "sm")}>
              Nous rejoindre
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Shobukan Dojo, club de kendo
      </footer>
    </div>
  );
}
