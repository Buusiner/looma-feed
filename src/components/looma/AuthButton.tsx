import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthButtonProps = {
  variant?: "header" | "sidebar";
};

export function AuthButton({ variant = "header" }: AuthButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setIsWorking(true);
    setError(null);

    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError("Não foi possível iniciar o login com Google.");
      setIsWorking(false);
    }
  }

  async function signOut() {
    setIsWorking(true);
    setError(null);

    const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
    if (signOutError) setError("Não foi possível encerrar sua sessão.");
    setIsWorking(false);
  }

  if (user) {
    // The sidebar owns the signed-in profile menu, including logout. Keeping
    // this component empty here avoids rendering a second account row.
    if (variant === "sidebar") return null;

    return (
      <div className={`auth-control ${variant === "sidebar" ? "auth-control-sidebar" : ""}`}>
        <span title={user.email ?? undefined}>{user.user_metadata.full_name ?? "Sua conta"}</span>
        <button type="button" onClick={signOut} disabled={isWorking}>
          Sair
        </button>
        {error ? <small role="alert">{error}</small> : null}
      </div>
    );
  }

  return (
    <div className={`auth-control ${variant === "sidebar" ? "auth-control-sidebar" : ""}`}>
      <button
        type="button"
        className={variant === "sidebar" ? "sidebar-google-login" : "auth-login-button"}
        onClick={signInWithGoogle}
        disabled={isWorking}
      >
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt=""
          aria-hidden="true"
        />
        <span>{isWorking ? "Conectando…" : "Entrar com Google"}</span>
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}
