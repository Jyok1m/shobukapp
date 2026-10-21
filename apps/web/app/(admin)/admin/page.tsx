import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminNav } from "@/components/shell/nav";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Administration" };

/*
 * A page renders in parallel with its layouts, so the layout redirect does not
 * keep the page out of the response: admin pages check the role themselves.
 */
async function AdminHome() {
  await requireUser("ADMIN");
  return (
    <div className="flex flex-col">
      <PageHeader title="Administration" description="Gestion du dojo, réservée aux administrateurs." />
      <Card>
        <ul className="flex flex-col divide-y divide-line">
          {adminNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block py-3 text-sm font-medium text-accent hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function AdminHomePage() {
  return (
    <Suspense fallback={null}>
      <AdminHome />
    </Suspense>
  );
}
