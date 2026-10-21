"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const EVENT = "shobukapp:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/* What is on screen: the stored choice, or the system preference until the user picks one. */
function readResolved(): ResolvedTheme {
  const attribute = document.documentElement.dataset.theme;
  if (attribute === "light" || attribute === "dark") return attribute;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
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
  // Another tab changed the theme: apply it here too, not only the button.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return;
    const choice = read();
    if (choice === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
    onChange();
  };
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onChange);
  };
}

/* null on the server and during hydration: the theme is only known in the browser. */
export function useResolvedTheme(): ResolvedTheme | null {
  return useSyncExternalStore(subscribe, readResolved, () => null);
}
