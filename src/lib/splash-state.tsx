import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

let hasShownSplash = false;
const WELCOME_SESSION_KEY = "looma-welcome-session";

declare global {
  interface Window {
    __loomaSplashShown?: boolean;
  }
}

export function claimInitialSplash() {
  if (typeof window === "undefined") return true;
  if (hasShownSplash || window.__loomaSplashShown) return false;
  hasShownSplash = true;
  window.__loomaSplashShown = true;
  return true;
}

function getSessionIdentity(user: User) {
  return `${user.id}:${user.last_sign_in_at ?? user.created_at}`;
}

export function shouldShowWelcome(user: User) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WELCOME_SESSION_KEY) !== getSessionIdentity(user);
}

export function markWelcomeShown(user: User) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WELCOME_SESSION_KEY, getSessionIdentity(user));
}

export function resetWelcomeSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WELCOME_SESSION_KEY);
}

type SplashContextValue = {
  shouldPlaySplash: boolean;
  completeSplash: () => void;
};

const SplashContext = createContext<SplashContextValue>({
  shouldPlaySplash: true,
  completeSplash: () => undefined,
});

export const SplashProvider = SplashContext.Provider;

export function useSplashState() {
  return useContext(SplashContext);
}
