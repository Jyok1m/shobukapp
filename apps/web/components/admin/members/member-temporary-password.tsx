"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { PASSWORD_MAX, passwordLengthError } from "@/lib/password";
import { generatePassword } from "./create-member-form";
import { PasswordConfirmField } from "./password-confirm-field";

/* POST /admin/members/:id/password (docs/members.md, Temporary password). */
export function MemberTemporaryPassword({ memberId, name }: { memberId: string; name: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [temporary, setTemporary] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Shown once after the change so the admin can copy it, then forgotten with the page. */
  const [handOver, setHandOver] = useState<string | null>(null);
  const lengthError = temporary ? passwordLengthError(temporary) : null;

  function start() {
    setTemporary(generatePassword());
    setPassword("");
    setError(null);
    setHandOver(null);
    setOpen(true);
  }

  async function confirm() {
    if (passwordLengthError(temporary)) return setError(passwordLengthError(temporary));
    if (!password) return setError("Saisissez votre mot de passe pour confirmer.");
    setPending(true);
    setError(null);
    const result = await apiRequest("POST", `/admin/members/${memberId}/password`, {
      temporaryPassword: temporary,
      password,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setPassword("");
    setHandOver(temporary);
    setTemporary("");
    toast.success("Mot de passe provisoire attribué", "Le membre est déconnecté et prévenu par e-mail.");
  }

  return (
    <Card
      title="Mot de passe"
      description="Si le membre n'arrive plus à se connecter, conseillez-lui d'abord « Mot de passe oublié ? » sur la page de connexion. Sinon, attribuez-lui un mot de passe provisoire, à remplacer dès sa prochaine connexion."
    >
      <div className="flex flex-col gap-4">
        <Button variant="secondary" onClick={start} className="self-start">
          Attribuer un mot de passe provisoire
        </Button>
        {handOver && (
          <div className="flex flex-col gap-3">
            <Notice tone="warning">
              Remettez ce mot de passe à {name} en main propre ou par téléphone, jamais par e-mail, puis ne le conservez
              pas. Il disparaîtra en quittant cette page.
            </Notice>
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-md border border-line bg-paper px-3 py-2 font-mono text-base text-ink select-all">{handOver}</code>
              <CopyButton value={handOver} />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={open}
        title={`Attribuer un mot de passe provisoire à ${name} ?`}
        description="Son mot de passe actuel cesse de fonctionner, tous ses appareils sont déconnectés et le membre devra choisir le sien dès sa prochaine connexion. Un e-mail le prévient, sans le mot de passe."
        confirmLabel="Attribuer"
        confirmVariant="primary"
        pending={pending}
        error={error}
        confirmDisabled={!password || Boolean(lengthError) || !temporary}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <Field
            id="temporary-password"
            label="Mot de passe provisoire"
            hint={`Généré au hasard, modifiable. ${temporary.length} caractères, de 10 à ${PASSWORD_MAX}.`}
            error={lengthError}
          >
            {(control) => (
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <PasswordInput
                    {...control}
                    value={temporary}
                    onChange={(event) => setTemporary(event.target.value)}
                    /* Not new-password: the browser would offer to save it in the admin's keychain. */
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    maxLength={PASSWORD_MAX}
                    disabled={pending}
                    className="font-mono"
                  />
                </div>
                <Button variant="secondary" onClick={() => setTemporary(generatePassword())} disabled={pending}>
                  Générer
                </Button>
              </div>
            )}
          </Field>
          <PasswordConfirmField id="temporary-password-confirm" value={password} onChange={setPassword} disabled={pending} />
        </div>
      </ConfirmDialog>
    </Card>
  );
}
