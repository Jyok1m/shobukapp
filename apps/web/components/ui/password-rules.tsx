import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";
import { cx } from "@/lib/cx";

type Rule = { ok: boolean; label: string };

/*
 * Live checklist under a new password, so the member sees what is still
 * missing before submitting. Announced politely: it changes on every keystroke.
 */
export function PasswordRules({
  id,
  password,
  confirmation,
  differentFrom,
}: {
  id: string;
  password: string;
  /* Omit when the form has no confirmation field. */
  confirmation?: string;
  /* The current or temporary password, when the new one must differ. */
  differentFrom?: { value: string; label: string };
}) {
  const rules: Rule[] = [
    {
      ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
      label:
        password.length > PASSWORD_MAX
          ? `${PASSWORD_MAX} caractères maximum (${password.length} saisis)`
          : `Au moins ${PASSWORD_MIN} caractères (${password.length}/${PASSWORD_MIN})`,
    },
  ];
  if (differentFrom)
    rules.push({ ok: password.length > 0 && password !== differentFrom.value, label: `Différent ${differentFrom.label}` });
  if (confirmation !== undefined)
    rules.push({ ok: password.length > 0 && password === confirmation, label: "Les deux saisies sont identiques" });

  return (
    <div id={id} className="flex flex-col gap-1.5 rounded-md border border-line bg-paper px-3 py-2">
      <p className="text-xs text-muted">
        Une phrase de plusieurs mots est plus sûre et plus facile à retenir qu&apos;un mot compliqué. Pas de règle de
        majuscules ni de symboles.
      </p>
      <ul aria-live="polite" className="flex flex-col gap-1 text-xs">
        {rules.map((rule) => (
          <li key={rule.label.split(" (")[0]} className={cx("flex items-center gap-2", rule.ok ? "text-success" : "text-muted")}>
            <span aria-hidden className={cx("flex size-4 shrink-0 items-center justify-center rounded-full border", rule.ok ? "border-success bg-success-soft" : "border-field")}>
              {rule.ok && (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                  <path d="m4 8.5 2.5 2.5L12 5.5" />
                </svg>
              )}
            </span>
            <span>
              {rule.label}
              <span className="sr-only">{rule.ok ? " : respecté" : " : pas encore respecté"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
