import Form from "next/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MemberQuery } from "./query";

/* GET form: the query lives in the URL, so a search can be shared and survives a reload. */
export function MemberSearch({ action, query }: { action: string; query: MemberQuery }) {
  return (
    <Form action={action} role="search" className="flex w-full gap-2 sm:max-w-md">
      {query.status && <input type="hidden" name="status" value={query.status} />}
      <label htmlFor="member-search" className="sr-only">
        Rechercher par nom, prénom ou e-mail
      </label>
      <Input
        id="member-search"
        name="q"
        type="search"
        defaultValue={query.q}
        placeholder="Nom, prénom ou e-mail"
        maxLength={100}
        autoComplete="off"
      />
      <Button type="submit" variant="secondary">
        Rechercher
      </Button>
    </Form>
  );
}
