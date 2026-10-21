"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type DialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /* False while an action runs: Escape and the backdrop then do nothing. */
  dismissible?: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

/*
 * Native <dialog> opened as modal: focus trap, Escape and inert background come
 * from the browser. Escape and a click on the backdrop call onClose.
 */
export function Dialog({ open, title, description, dismissible = true, onClose, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
      className={cx(
        "m-auto max-h-11/12 w-11/12 max-w-md overflow-y-auto rounded-lg border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="font-serif text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="text-sm text-muted">
              {description}
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
