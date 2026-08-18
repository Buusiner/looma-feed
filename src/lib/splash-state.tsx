import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/browser";

let hasShownSplash = false;
const WELCOME_METADATA_KEY = "looma_welcome_seen_at";
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

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

function isNewAccount(user: User) {
  const createdAt = Date.parse(user.created_at);
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? user.created_at);
  return Number.isFinite(createdAt) && Number.isFinite(lastSignInAt) && Math.abs(lastSignInAt - createdAt) <= NEW_ACCOUNT_WINDOW_MS;
}

export function shouldShowWelcome(user: User) {
  return isNewAccount(user) && !user.user_metadata?.[WELCOME_METADATA_KEY];
}

export async function markWelcomeShown(_user: User) {
  const { error } = await getSupabaseBrowserClient().auth.updateUser({
    data: { [WELCOME_METADATA_KEY]: new Date().toISOString() },
  });

  if (error) console.error("Não foi possível registrar as boas-vindas da Looma:", error.message);
}

type SplashContextValue = {
  shouldPlaySplash: boolean;
  completeSplash: () => void;
  startSplash: () => void;
};

const SplashContext = createContext<SplashContextValue>({
  shouldPlaySplash: true,
  completeSplash: () => undefined,
  startSplash: () => undefined,
});

export const SplashProvider = SplashContext.Provider;

export function useSplashState() {
  return useContext(SplashContext);
}
