import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { recordUserTrafficEvent } from "../lib/activity-metrics";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SplashProvider } from "../lib/splash-state";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { useCurrentProfile } from "../lib/profile";
import { OnboardingGate } from "../components/looma/OnboardingGate";
import { applyTheme, getStoredTheme } from "../lib/theme";

const themeBootstrapScript = `
  (function () {
    var root = document.documentElement;
    var theme = "dark";

    try {
      var storedTheme = window.localStorage.getItem("looma-theme");
      theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "dark";
    } catch (_error) {
      // Storage may be unavailable in private browser contexts. Dark remains
      // the product default in that case.
    }

    var resolvedTheme = theme;
    if (theme === "system") {
      resolvedTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }

    var themeColor = resolvedTheme === "dark" ? "#0A0A0B" : "#FAFAFA";
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.content = themeColor;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolvedTheme;
    root.classList.add("looma-theme-ready");
  })();
`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou mudou de endereço.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const reportedError = useMemo(() => {
    if (error instanceof Error) return error;
    if (typeof error === "string") return new Error(error);
    return new Error("Erro desconhecido");
  }, [error]);

  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(reportedError, { boundary: "tanstack_root_error_component" });
  }, [reportedError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado por aqui. Você pode tentar novamente ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "looma" },
      { name: "description", content: "Rede social para criadores e freelancers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/looma-logo-mark.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <style>{`
          html { background-color: #0A0A0B; color-scheme: dark; }
          html:not(.looma-theme-ready) body { visibility: hidden; }
          html.looma-theme-ready:not(.dark) { background-color: #FAFAFA; color-scheme: light; }
          html.looma-theme-ready.dark { color-scheme: dark; }
        `}</style>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useLocation({ select: (location: { pathname: string }) => location.pathname });
  const lastTrafficEventRef = useRef<string | null>(null);
  function shouldStartSplash(currentPathname: string) {
    if (typeof window === "undefined" || currentPathname !== "/") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (window.__loomaSplashShown) return false;

    const navigationEntry = window.performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const navigationType = navigationEntry?.type;
    if (navigationType === "reload" || navigationType === "back_forward") return false;

    window.__loomaSplashShown = true;
    return true;
  }
  const [isSplashActive, setIsSplashActive] = useState(() => {
    return shouldStartSplash(pathname);
  });
  const completeSplash = useCallback(() => setIsSplashActive(false), []);
  const startSplash = useCallback(() => {
    if (shouldStartSplash(window.location.pathname)) setIsSplashActive(true);
  }, []);
  const { user, profile, refresh } = useCurrentProfile();
  const shouldShowOnboarding = Boolean(
    // Keep the gate mounted while the profile cache refreshes after a step is
    // saved. Otherwise that brief loading state remounts the component and
    // resets it back to Step 1.
    user &&
    profile &&
    !profile.onboarding_completed_at &&
    !isSplashActive &&
    pathname !== "/perfil/editar",
  );

  useEffect(() => {
    applyTheme(getStoredTheme());

    function syncTheme(event: StorageEvent) {
      if (event.key === "looma-theme") applyTheme(getStoredTheme());
    }

    function syncSystemTheme() {
      if (getStoredTheme() === "system") applyTheme("system");
    }

    const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", syncTheme);
    themeMediaQuery.addEventListener("change", syncSystemTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      themeMediaQuery.removeEventListener("change", syncSystemTheme);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let currentUserId = user?.id ?? null;
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId === currentUserId && event !== "SIGNED_OUT") return;
      currentUserId = nextUserId;

      if (event === "SIGNED_IN" && session?.user) {
        if (window.location.pathname !== "/") void router.navigate({ to: "/" });
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [router, user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const trafficEventKey = `${user.id}:${pathname}`;
    if (lastTrafficEventRef.current === trafficEventKey) return;
    lastTrafficEventRef.current = trafficEventKey;

    void recordUserTrafficEvent(getSupabaseBrowserClient(), user.id, {
      path: pathname,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent || null,
    }).then(({ error }) => {
      if (error) {
        console.error("Não foi possível registrar o tráfego real do usuário:", error.message);
      }
    });
  }, [pathname, user?.id]);

  return (
    <QueryClientProvider client={queryClient}>
      <SplashProvider value={{ shouldPlaySplash: isSplashActive, completeSplash, startSplash }}>
        <Outlet />
        {shouldShowOnboarding && profile ? (
          <OnboardingGate user={user!} profile={profile} refreshProfile={refresh} />
        ) : null}
      </SplashProvider>
    </QueryClientProvider>
  );
}
