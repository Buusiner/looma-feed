import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

function getBrowserConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
  }

  return { url, key };
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = getBrowserConfig();
    browserClient = createBrowserClient(url, key);
  }

  return browserClient;
}

export function createSupabaseCredentialClient(): SupabaseClient {
  const { url, key } = getBrowserConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
