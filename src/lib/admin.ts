import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AdminAccess = {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
};

export function useAdminAccess(user: User | null): AdminAccess {
  const userId = user?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadAdminAccess() {
      if (!userId) {
        if (!isCurrent) return;
        setIsAdmin(false);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error: accessError } = await getSupabaseBrowserClient()
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!isCurrent) return;
      if (accessError) {
        console.error("[Looma] Não foi possível verificar o acesso administrativo.", accessError);
        setIsAdmin(false);
        setError(accessError.message);
      } else {
        setIsAdmin(Boolean(data));
        setError(null);
      }
      setIsLoading(false);
    }

    void loadAdminAccess();

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  return { isAdmin, isLoading, error };
}
