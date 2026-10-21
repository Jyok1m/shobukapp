"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { DojoContact } from "@/components/dojo-contact";
import { DojoSiteLink } from "@/components/dojo-site-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { cx } from "@/lib/cx";
import type { Role, StripeMode } from "@/lib/types";
import { LogoutButton } from "./logout-button";
import { adminNav, memberNav, type NavItem } from "./nav";
import { useJoinRequestCount } from "./use-join-request-count";
import { useUnreadCount } from "./use-unread-count";

export type ShellUser = { firstName: string; lastName: string; role: Role };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  items,
  pathname,
  onNavigate,
  badges = {},
}: {
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
  /* Count shown next to an item, by href, with its screen reader wording. Zero hides it. */
  badges?: Record<string, { count: number; label: (count: number) => string }>;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = badges[item.href]?.count ?? 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm lg:min-h-9 transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-ink/5",
              )}
            >
              {item.label}
              {badge > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
                  {badge > 99 ? "99+" : badge}
                  <span className="sr-only"> {badges[item.href]?.label(badge)}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const unreadLabel = (count: number) => (count > 1 ? "messages non lus" : "message non lu");
const newRequestsLabel = (count: number) => (count > 1 ? "nouvelles demandes" : "nouvelle demande");

export function AppShell({
  user,
  billingMode = null,
  children,
}: {
  user: ShellUser;
  /* Read for admins only: the test mode banner. */
  billingMode?: StripeMode | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const unread = useUnreadCount();
  const newRequests = useJoinRequestCount(user.role === "ADMIN");

  const navigation = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-6">
      <NavList items={memberNav} pathname={pathname} onNavigate={close} badges={{ "/messagerie": { count: unread, label: unreadLabel } }} />
      {user.role === "ADMIN" && (
        <div className="flex flex-col gap-2">
          <p className="px-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Administration
          </p>
          <NavList items={adminNav} pathname={pathname} onNavigate={close} badges={{ "/admin/demandes": { count: newRequests, label: newRequestsLabel } }} />
        </div>
      )}
      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <DojoSiteLink className="min-h-11 rounded-md px-3 text-sm text-muted hover:bg-ink/5 hover:text-ink lg:min-h-9" />
        <DojoContact compact className="px-3 text-xs text-muted" />
      </div>
    </nav>
  );

  const account = (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="truncate px-3 text-sm font-medium text-ink">
        {user.firstName} {user.lastName}
      </p>
      <ThemeToggle />
      <LogoutButton className="w-full" />
    </div>
  );

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Brand href="/tableau-de-bord" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {open ? "Fermer" : "Menu"}
          {!open && unread + newRequests > 0 && (
            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
              {unread + newRequests > 99 ? "99+" : unread + newRequests}
              <span className="sr-only"> nouveauté{unread + newRequests > 1 ? "s" : ""} dans le menu</span>
            </span>
          )}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 top-14 z-20 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={close}
            className="absolute inset-0 bg-scrim/40"
          />
          <div
            id="mobile-nav"
            className="relative flex max-h-full w-72 max-w-full flex-col gap-6 overflow-y-auto border-r border-line bg-surface p-4"
          >
            {navigation}
            {account}
          </div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <Brand href="/tableau-de-bord" className="px-3 pt-2" />
        <div className="flex-1 overflow-y-auto">{navigation}</div>
        {account}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {billingMode === "test" && (
          <p className="mb-6 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning sm:text-sm">
            Stripe est en mode test : les paiements sont simulés.{" "}
            <Link href="/admin/formules" className="font-medium underline underline-offset-2">
              Gérer le mode de paiement
            </Link>
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
