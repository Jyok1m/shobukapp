"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { cx } from "@/lib/cx";
import type { Role } from "@/lib/types";
import { LogoutButton } from "./logout-button";
import { adminNav, memberNav, type NavItem } from "./nav";

export type ShellUser = { firstName: string; lastName: string; role: Role };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "block rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-ink/5",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const navigation = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-6">
      <NavList items={memberNav} pathname={pathname} onNavigate={close} />
      {user.role === "ADMIN" && (
        <div className="flex flex-col gap-2">
          <p className="px-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Administration
          </p>
          <NavList items={adminNav} pathname={pathname} onNavigate={close} />
        </div>
      )}
    </nav>
  );

  const account = (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="truncate px-3 text-sm font-medium text-ink">
        {user.firstName} {user.lastName}
      </p>
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
          className="rounded-md px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {open ? "Fermer" : "Menu"}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 top-14 z-20 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={close}
            className="absolute inset-0 bg-ink/30"
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
        {children}
      </main>
    </div>
  );
}
