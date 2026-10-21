"use client";

import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "./button";
import { Dialog } from "./dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  pending?: boolean;
  error?: string | null;
  /* Extra content between the description and the buttons (a typed confirmation, for instance). */
  children?: ReactNode;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/* Every destructive action goes through this dialog (docs/design.md). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  confirmVariant = "danger",
  pending = false,
  error,
  children,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} description={description} dismissible={!pending} onClose={onCancel}>
      {children}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} loading={pending} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
