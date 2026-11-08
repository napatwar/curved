import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

export const themePreferences: readonly ThemePreference[] = ["system", "light", "dark"];

// index.html reads the same key before the first paint. Keep them in sync.
const storageKey = "curved:theme";
const darkQuery = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** The theme chosen on this device. Storage can be unavailable. */
export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

/** Adds or removes the `dark` class on `<html>` for a preference. */
export function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && matchMedia(darkQuery).matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, preference);
    }
  } catch {
    // The theme still changes for this page.
  }
  applyTheme(preference);
  notify();
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Follows the system theme, and theme changes made in another tab. Call it
 * once when the app starts.
 */
export function startThemeSync() {
  applyTheme(readThemePreference());
  matchMedia(darkQuery).addEventListener("change", () => applyTheme(readThemePreference()));
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) {
      applyTheme(readThemePreference());
      notify();
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current preference, kept in step with the system and other tabs. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference);
}
