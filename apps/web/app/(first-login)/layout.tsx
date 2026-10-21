import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/shell/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

/* No app navigation: until the temporary password is replaced, every other page is closed. */
export default function FirstLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Brand href="/premiere-connexion" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
