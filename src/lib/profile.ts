import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string | null;
  onboarding_completed_at: string | null;
  experience_level: "iniciante" | "intermediario" | "experiente" | null;
  is_admin: boolean;
};

export function getProfileName(profile: Profile | null, user: User | null) {
  return (
    profile?.full_name?.trim() ||
    user?.user_metadata["full_name"]?.trim() ||
    user?.user_metadata["name"]?.trim() ||
    user?.email?.split("@")[0] ||
    "Sua conta"
  );
}

export function getProfileUsername(profile: Profile | null, user: User | null) {
  const username = profile?.username?.trim() || user?.user_metadata["user_name"]?.trim();
  return username ? `@${username.replace(/^@/, "")}` : "Configure seu @username";
}

export function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "LO";
}

export function useCurrentProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (knownUser?: User | null) => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const authResult = knownUser === undefined ? await supabase.auth.getUser() : null;
      const activeUser = knownUser === undefined ? authResult?.data.user : knownUser;

      // Supabase returns this error when there is no persisted session. That is the
      // expected anonymous state for the public product shell, not an application
      // failure worth surfacing in the console.
      if (authResult?.error && authResult.error.name !== "AuthSessionMissingError") {
        console.error("[Looma] Não foi possível ler a sessão do Supabase.", authResult.error);
      }

      setUser(activeUser ?? null);
      if (!activeUser) {
        setProfile(null);
        setProfileError(null);
        return null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, bio, created_at, onboarding_completed_at, experience_level, is_admin",
        )
        .eq("id", activeUser.id)
        .maybeSingle();

      if (error) {
        console.error("[Looma] Falha ao buscar profiles para o usuário autenticado.", {
          userId: activeUser.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setProfile(null);
        setProfileError(error.message);
        return null;
      }

      setProfile(data);
      setProfileError(null);
      return data;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Não foi possível carregar a conta.";
      console.error("[Looma] Erro inesperado ao carregar a conta.", caught);
      setUser(null);
      setProfile(null);
      setProfileError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        void refresh(session?.user ?? null);
      });

      return () => subscription.subscription.unsubscribe();
    } catch {
      // refresh() already records the configuration error and clears loading.
      // A failed auth subscription must not unmount the public interface.
      return;
    }
  }, [refresh]);

  return { user, profile, profileError, isLoading, refresh };
}
