export type LoomaTheme = "light" | "dark";

const THEME_STORAGE_KEY = "looma-theme";

export function getStoredTheme(): LoomaTheme {
  if (typeof window === "undefined") return "light";

  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: LoomaTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset["theme"] = theme;
  document.documentElement.classList.add("looma-theme-ready");
}

export function saveTheme(theme: LoomaTheme) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  applyTheme(theme);
}
