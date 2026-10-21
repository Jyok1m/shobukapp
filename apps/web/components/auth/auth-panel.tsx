import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-0">
      <Card>
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-serif text-2xl font-bold text-ink">{title}</h1>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}
