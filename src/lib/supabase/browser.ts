import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

function getBrowserConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
  }

  return { url, key };
}

/** Reutiliza uma única instância do cliente Supabase no navegador. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = getBrowserConfig();
    browserClient = createBrowserClient(url, key);
  }

  return browserClient;
}
