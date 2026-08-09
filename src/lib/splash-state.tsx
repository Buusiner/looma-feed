import { createContext, useContext } from "react";

// This lives only for the lifetime of the browser JavaScript module. A real
// reload recreates the module and therefore plays the branding splash again.
let hasShownSplash = false;

declare global {
  interface Window {
    __loomaSplashShown?: boolean;
  }
}

export function claimInitialSplash() {
  // Keep server and first browser render consistent; the server never mutates
  // the flag, while the browser claims it once for the active app instance.
  if (typeof window === "undefined") return true;
  if (hasShownSplash || window.__loomaSplashShown) return false;
  hasShownSplash = true;
  window.__loomaSplashShown = true;
  return true;
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
