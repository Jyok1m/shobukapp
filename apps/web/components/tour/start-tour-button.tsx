"use client";

import { Button, type ButtonVariant } from "@/components/ui/button";
import type { TourVariant } from "./steps";
import { useTour } from "./tour";

export function StartTourButton({
  variant,
  label,
  buttonVariant = "primary",
}: {
  variant: TourVariant;
  label: string;
  buttonVariant?: ButtonVariant;
}) {
  const { start } = useTour();
  return (
    <Button variant={buttonVariant} onClick={() => start(variant)}>
      {label}
    </Button>
  );
}
