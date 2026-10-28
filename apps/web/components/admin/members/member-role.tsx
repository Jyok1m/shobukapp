"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { AdminMemberDetail, Role, RoleChange } from "@/lib/types";
import { PasswordConfirmField } from "./password-confirm-field";

export const roleLabels: Record<Role, string> = { ADMIN: "Administrateur", PRACTITIONER: "Pratiquant" };

export function MemberRole({
  memberId,
  name,
  role,
  history,
  isSelf,
}: {
  memberId: string;
  name: string;
  role: Role;
  history: RoleChange[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promote = role === "PRACTITIONER";
  const target: Role = promote ? "ADMIN" : "PRACTITIONER";

  async function confirm() {
    if (!password) return setError("Saisissez votre mot de passe pour confirmer.");
    setPending(true);
    setError(null);
    const result = await apiRequest<AdminMemberDetail>("PATCH", `/admin/members/${memberId}/role`, { role: target, password });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setPassword("");
    toast.success(promote ? `${name} est maintenant administrateur` : `${name} n'est plus administrateur`, "Un e-mail l'en a informé.");
    router.refresh();
  }

  return (
    <Card title="Rôle">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-ink">
            Rôle actuel : <Badge tone={role === "ADMIN" ? "accent" : "neutral"}>{roleLabels[role]}</Badge>
          </p>
          {!isSelf && (
            <Button
              variant={promote ? "secondary" : "ghost-danger"}
              onClick={() => {
                setPassword("");
                setError(null);
                setOpen(true);
              }}
            >
              {promote ? "Nommer administrateur" : "Retirer les droits d'administration"}
            </Button>
          )}
        </div>
        {isSelf && <p className="text-sm text-muted">Vous ne pouvez pas modifier votre propre rôle.</p>}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Historique</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Aucun changement de rôle.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {history.map((change, index) => (
                <li key={`${change.createdAt}-${index}`} className="py-2">
                  <span className="font-medium text-ink">
                    {roleLabels[change.fromRole]} vers {roleLabels[change.toRole]}
                  </span>
                  <span className="text-muted">
                    , le {formatDate(change.createdAt)}
                    {change.changedBy
                      ? `, par ${change.changedBy.firstName} ${change.changedBy.lastName}`
                      : ", par un administrateur supprimé"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={open}
        title={promote ? `Nommer ${name} administrateur ?` : `Retirer les droits d'administration de ${name} ?`}
        description={
          promote
            ? "Un administrateur a accès à toutes les données des membres : coordonnées, informations de licence, paiements, documents et certificats médicaux. Il peut aussi modifier les formules et les rôles. Le membre est prévenu par e-mail."
            : "Le membre perd immédiatement l'accès à l'administration et redevient simple pratiquant. Il est prévenu par e-mail."
        }
        confirmLabel={promote ? "Nommer administrateur" : "Retirer les droits"}
        confirmVariant={promote ? "primary" : "danger"}
        pending={pending}
        error={error}
        confirmDisabled={!password}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <PasswordConfirmField id="role-password" value={password} onChange={setPassword} disabled={pending} />
      </ConfirmDialog>
    </Card>
  );
}
