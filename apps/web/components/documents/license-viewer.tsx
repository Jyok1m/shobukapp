"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DISCIPLINE_LABELS } from "@/lib/documents";
import type { License } from "@/lib/types";

/* Accent text action: the ghost button's ink colour cannot be overridden through className. */
const linkAction =
  "inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-accent hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-8";

/* "Voir" and "Télécharger" for a licence file. The view route answers inline, framed by the same origin only. */
export function LicenseFileActions({ license }: { license: Pick<License, "id" | "season" | "discipline"> }) {
  const [open, setOpen] = useState(false);
  const label = `${DISCIPLINE_LABELS[license.discipline]} ${license.season}`;
  const viewUrl = `/api/licenses/${license.id}/view`;
  const downloadUrl = `/api/licenses/${license.id}/file`;
  const download = (
    <a
      href={downloadUrl}
      download
      className={linkAction}
      aria-label={`Télécharger la licence ${label}`}
    >
      Télécharger
    </a>
  );

  return (
    <>
      <button type="button" className={linkAction} onClick={() => setOpen(true)} aria-label={`Voir la licence ${label}`}>
        Voir
      </button>
      {download}
      <Dialog open={open} title={`Licence ${label}`} onClose={() => setOpen(false)} size="4xl">
        <iframe
          src={viewUrl}
          title={`Fichier de la licence ${label}`}
          className="h-112 w-full rounded-md border border-line bg-paper sm:h-160"
        />
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener"
            className={linkAction}
          >
            Ouvrir dans un nouvel onglet
          </a>
          {download}
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>
      </Dialog>
    </>
  );
}
