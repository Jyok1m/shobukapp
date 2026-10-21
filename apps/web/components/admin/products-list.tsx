"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client-api";
import { formatAmount } from "@/lib/format";
import type { AdminProduct, ProductKind } from "@/lib/types";

const GROUPS: { kind: ProductKind; title: string }[] = [
  { kind: "FEDERATION", title: "Fédération (FFJDA)" },
  { kind: "MISC", title: "Divers" },
];

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

type Errors = Partial<Record<"name" | "amount", string>>;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProductsList({ products }: { products: AdminProduct[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="Aucun produit"
        description="Les produits (licence, passeport, cours particuliers...) sont importés avec la grille tarifaire de la saison."
      />
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => {
        const items = products.filter((product) => product.kind === group.kind);
        if (items.length === 0) return null;
        const titleId = `products-${group.kind.toLowerCase()}`;
        return (
          <section key={group.kind} className="flex flex-col gap-3" aria-labelledby={titleId}>
            <h2 id={titleId} className="font-serif text-xl font-semibold text-ink">
              {group.title}
            </h2>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
              {items.map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ProductRow({ product }: { product: AdminProduct }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-ink">{product.name}</h3>
            {!product.active && <Badge>Désactivé</Badge>}
          </div>
          {product.description && <p className="text-sm whitespace-pre-line text-muted">{product.description}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone={product.memberPurchasable ? "accent" : "neutral"}>
              {product.memberPurchasable ? "Achat libre par les pratiquants" : "Demandé par le bureau"}
            </Badge>
            {product.perSeason && <Badge>Une fois par saison</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <span className="text-lg font-semibold whitespace-nowrap text-ink">
            {formatAmount(product.amountCents, product.currency)}
          </span>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label={`Modifier ${product.name}`}>
              Modifier
            </Button>
          )}
        </div>
      </div>
      {editing && <ProductEditForm product={product} onDone={() => setEditing(false)} />}
    </li>
  );
}

function ProductEditForm({ product, onDone }: { product: AdminProduct; onDone: () => void }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = (name: string) => `product-${product.id}-${name}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const raw = String(data.get("amount") ?? "").trim().replace(/\s/g, "").replace(",", ".");
    const valid = /^\d+(\.\d{1,2})?$/.test(raw);
    const amountCents = valid ? Math.round(Number(raw) * 100) : NaN;
    const memberPurchasable = data.get("memberPurchasable") === "on";
    const active = data.get("active") === "on";

    const next: Errors = {};
    if (!name) next.name = "Indiquez le nom du produit.";
    if (!valid) next.amount = "Indiquez un montant en euros, par exemple 56 ou 15,50.";
    else if (amountCents < MIN_CENTS) next.amount = "Le montant minimum est de 1 €.";
    else if (amountCents > MAX_CENTS) next.amount = "Le montant maximum est de 10 000 €.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    // Only what changed.
    const changes: Record<string, unknown> = {};
    if (name !== product.name) changes.name = name;
    if (description !== (product.description ?? "")) changes.description = description;
    if (amountCents !== product.amountCents) changes.amountCents = amountCents;
    if (memberPurchasable !== product.memberPurchasable) changes.memberPurchasable = memberPurchasable;
    if (active !== product.active) changes.active = active;
    if (Object.keys(changes).length === 0) return onDone();

    setPending(true);
    const result = await apiRequest<AdminProduct>("PATCH", `/admin/products/${product.id}`, changes);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t border-line pt-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("name")} label="Nom" error={errors.name}>
          {(control) => <Input {...control} name="name" defaultValue={product.name} maxLength={80} required />}
        </Field>
        <Field id={id("amount")} label="Montant (€)" error={errors.amount}>
          {(control) => (
            <div className="relative">
              <Input
                {...control}
                name="amount"
                inputMode="decimal"
                defaultValue={centsToInput(product.amountCents)}
                className="pr-8 text-right"
              />
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
                €
              </span>
            </div>
          )}
        </Field>
        <Field id={id("description")} label="Description" hint="Facultatif." className="sm:col-span-2">
          {(control) => (
            <Textarea {...control} name="description" defaultValue={product.description ?? ""} maxLength={300} rows={2} />
          )}
        </Field>
        <label htmlFor={id("purchasable")} className="flex min-h-11 items-center gap-2 text-sm text-ink sm:min-h-0">
          <input
            id={id("purchasable")}
            name="memberPurchasable"
            type="checkbox"
            defaultChecked={product.memberPurchasable}
            className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          Achetable par les pratiquants depuis leur tableau de bord
        </label>
        <label htmlFor={id("active")} className="flex min-h-11 items-center gap-2 text-sm text-ink sm:min-h-0">
          <input
            id={id("active")}
            name="active"
            type="checkbox"
            defaultChecked={product.active}
            className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          Actif
        </label>
      </div>
      <FormAlert message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
