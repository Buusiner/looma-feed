import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type SupabaseWorkerEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type ServerClientOptions = {
  request: Request;
  responseHeaders: Headers;
  env?: SupabaseWorkerEnv;
};

function getLocalServerEnv(name: string) {
  // Available in Vite/Nitro local development. Cloudflare uses the explicit
  // `env` Worker binding passed to the helpers below.
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function getServerConfig(env?: SupabaseWorkerEnv) {
  // Cloudflare bindings are available through `env`; Vite provides the fallback
  // while developing locally with `.env`.
  const url =
    env?.SUPABASE_URL ??
    getLocalServerEnv("SUPABASE_URL") ??
    import.meta.env.SUPABASE_URL ??
    import.meta.env.VITE_SUPABASE_URL;
  const key =
    env?.SUPABASE_ANON_KEY ??
    getLocalServerEnv("SUPABASE_ANON_KEY") ??
    import.meta.env.SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias no ambiente do servidor.");
  }

  return { url, key };
}

/** Cliente exclusivamente de servidor para tarefas administrativas do Storage. */
export function createSupabaseAdminClient(env?: SupabaseWorkerEnv) {
  const serviceRoleKey =
    env?.SUPABASE_SERVICE_ROLE_KEY ??
    getLocalServerEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  const { url } = getServerConfig(env);
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function readCookies(cookieHeader: string | null) {
  if (!cookieHeader) return [];

  return cookieHeader.split(/;\s*/).flatMap((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) return [];

    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1);

    try {
      return [{ name, value: decodeURIComponent(value) }];
    } catch {
      return [{ name, value }];
    }
  });
}

function serializeCookie(name: string, value: string, options: CookieOptions) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.partitioned) parts.push("Partitioned");

  if (options.sameSite) {
    const sameSite = options.sameSite === true ? "Strict" : options.sameSite;
    parts.push(`SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`);
  }

  return parts.join("; ");
}

/**
 * Cliente SSR para handlers que recebem o `Request` e bindings do Worker.
 * Cookies gravados pelo Supabase são adicionados aos headers da resposta.
 */
export function createSupabaseServerClient({ request, responseHeaders, env }: ServerClientOptions) {
  const { url, key } = getServerConfig(env);

  return createServerClient(url, key, {
    cookies: {
      getAll: () => readCookies(request.headers.get("cookie")),
      setAll: (cookiesToSet, headersToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          responseHeaders.append("set-cookie", serializeCookie(name, value, options));
        }

        for (const [name, value] of Object.entries(headersToSet)) {
          responseHeaders.set(name, value);
        }
      },
    },
  });
}

export async function getAuthenticatedUser(options: ServerClientOptions): Promise<User | null> {
  const supabase = createSupabaseServerClient(options);
  const { data, error } = await supabase.auth.getUser();

  if (error) return null;
  return data.user;
}
