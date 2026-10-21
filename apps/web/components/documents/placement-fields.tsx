"use client";

import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { placementLabels } from "@/lib/documents";
import type { DocumentCategory, Placement } from "@/lib/types";

const placements: Placement[] = ["PRIVATE", "ANNOUNCEMENT", "IMPORTANT"];

/* Where a dojo document shows, and the text shown with it. Shared by the upload form and the display dialog. */
export function PlacementFields({
  idPrefix,
  category,
  placement,
  onPlacementChange,
  defaultDescription,
}: {
  idPrefix: string;
  category: DocumentCategory;
  placement: Placement;
  onPlacementChange: (placement: Placement) => void;
  defaultDescription?: string | null;
}) {
  return (
    <>
      <Field
        id={`${idPrefix}-placement`}
        label="Affichage"
        hint="Un document publié est visible et téléchargeable par tous les membres connectés, sur leur tableau de bord."
      >
        {(control) => (
          <Select
            {...control}
            name="placement"
            value={placement}
            onChange={(event) => onPlacementChange(event.target.value as Placement)}
          >
            {placements.map((value) => (
              <option key={value} value={value}>
                {placementLabels[value].option}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        id={`${idPrefix}-description`}
        label="Description (facultatif)"
        hint="Affichée avec le document sur le tableau de bord. 500 caractères maximum."
        className="sm:col-span-2"
      >
        {(control) => (
          <Textarea {...control} name="description" defaultValue={defaultDescription ?? ""} maxLength={500} rows={3} />
        )}
      </Field>
      {category === "ACCOUNTING" && placement !== "PRIVATE" && (
        <Notice tone="warning" className="sm:col-span-2">
          Ce document sera visible par tous les membres.
        </Notice>
      )}
    </>
  );
}
