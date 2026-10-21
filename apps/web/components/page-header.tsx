import type { ReactNode } from "react";

export function PageHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-1">
      <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      {description && <p className="text-sm text-muted">{description}</p>}
    </div>
  );
}
