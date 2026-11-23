// Themes (studio-experience 1.4): Daylight and After hours. A stored choice wins; otherwise the
// system colour scheme decides. index.html applies the same rule before first paint. One store for
// the whole page, so the Story, the Studio and the 3D loom always agree.
import { useSyncExternalStore } from "react";

export const THEMES = ["daylight", "after-hours"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "jacquard.theme";
export const THEME_LABELS: Readonly<Record<Theme, string>> = { daylight: "Daylight", "after-hours": "After hours" };

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function resolveTheme(stored: string | null | undefined, systemDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return systemDark ? "after-hours" : "daylight";
}

function readStored(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function darkQuery(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = theme;
  document.documentElement.style.colorScheme = theme === "after-hours" ? "dark" : "light";
}

const listeners = new Set<() => void>();
let current: Theme | null = null;

function read(): Theme {
  if (current === null) current = resolveTheme(readStored(), darkQuery()?.matches ?? false);
  return current;
}

function emit(next: Theme): void {
  current = next;
  applyTheme(next);
  for (const listener of listeners) listener();
}

function onSystemChange(): void {
  if (!isTheme(readStored())) emit(resolveTheme(null, darkQuery()?.matches ?? false));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) darkQuery()?.addEventListener?.("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) darkQuery()?.removeEventListener?.("change", onSystemChange);
  };
}

export function setTheme(next: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  emit(next);
}

/** Forgets the cached value; for tests that change storage or the system preference. */
export function resetThemeForTests(): void {
  current = null;
}

/** The current Theme and the setter that stores the choice. */
export function useTheme(): readonly [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "daylight" as Theme);
  return [theme, setTheme] as const;
}
