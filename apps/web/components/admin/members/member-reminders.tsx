"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { PaymentReminder } from "@/lib/types";
import { ReminderDialog, reminderToast, type ReminderTarget } from "./reminder-dialog";

export function MemberReminders({ member, reminders }: { member: ReminderTarget; reminders: PaymentReminder[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ReminderTarget | null>(null);
  const toast = useToast();

  return (
    <Card title="Relances de paiement" description="Les relances envoyées à ce membre, de la plus récente à la plus ancienne.">
      <div className="flex flex-col gap-4">
        <Button variant="secondary" onClick={() => setTarget(member)} className="self-start">
          Relancer
        </Button>
        {reminders.length === 0 ? (
          <p className="text-sm text-muted">Aucune relance pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="py-3 text-sm">
                <p className="text-ink">
                  <span className="font-medium">{formatDate(reminder.createdAt)}</span>
                  <span className="text-muted">
                    {reminder.sentBy
                      ? `, par ${reminder.sentBy.firstName} ${reminder.sentBy.lastName}`
                      : ", par un administrateur supprimé"}
                  </span>
                </p>
                {reminder.note && <p className="mt-1 whitespace-pre-line text-muted">{reminder.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ReminderDialog
        target={target}
        onClose={() => setTarget(null)}
        onSent={(result, sent) => {
          toast.show(reminderToast(result, sent.name));
          setTarget(null);
          router.refresh();
        }}
      />
    </Card>
  );
}
