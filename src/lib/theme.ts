import { audioManager } from "./audio-manager";

export type LoomaTheme = "light" | "dark" | "system";
export type ResolvedLoomaTheme = "light" | "dark";

const THEME_STORAGE_KEY = "looma-theme";

export function getStoredTheme(): LoomaTheme {
  if (typeof window === "undefined") return "dark";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
    ? storedTheme
    : "dark";
}

export function resolveTheme(theme: LoomaTheme): ResolvedLoomaTheme {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: LoomaTheme) {
  if (typeof document === "undefined") return;

  const resolvedTheme = resolveTheme(theme);
  const themeColor = resolvedTheme === "dark" ? "#0A0A0B" : "#FAFAFA";
  let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.content = themeColor;
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.dataset["theme"] = theme;
  document.documentElement.dataset["resolvedTheme"] = resolvedTheme;
  document.documentElement.classList.add("looma-theme-ready");
}

export function saveTheme(theme: LoomaTheme) {
  const previous =
    typeof document === "undefined" ? null : document.documentElement.dataset["resolvedTheme"];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  applyTheme(theme);
  const next = resolveTheme(theme);
  if (previous && previous !== next)
    audioManager.play(next === "dark" ? "themeDark" : "themeLight");
}
