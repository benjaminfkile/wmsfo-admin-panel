import type { AppThemeMode } from "./theme";

const KEY = "appThemeMode";

export function getStoredTheme(): AppThemeMode {
  const stored = localStorage.getItem(KEY);
  return stored === "dark" ? "dark" : "light";
}

export function setStoredTheme(mode: AppThemeMode) {
  localStorage.setItem(KEY, mode);
}
