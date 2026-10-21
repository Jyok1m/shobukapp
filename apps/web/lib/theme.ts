"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

export type ThemeChoice = "light" | "dark" | "system";

const EVENT = "shobukapp:theme";

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked (private mode): the choice still applies to this page.
  }
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  // Another tab changed the theme: apply it here too, not only the selector.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return;
    const choice = read();
    if (choice === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, read, () => "system");
}
