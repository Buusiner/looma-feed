import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getAuthenticatedUser,
  type SupabaseWorkerEnv,
} from "./lib/supabase/server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function appendResponseHeaders(response: Response, extraHeaders: Headers): Response {
  for (const [name, value] of extraHeaders.entries()) {
    if (name.toLowerCase() === "set-cookie") response.headers.append(name, value);
    else response.headers.set(name, value);
  }

  return response;
}

function redirectWithHeaders(location: string, headers: Headers): Response {
  headers.set("location", location);
  return new Response(null, { status: 302, headers });
}

function getSafeNextPath(next: string | null): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function handleAuthCallback(request: Request, env: SupabaseWorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const responseHeaders = new Headers();
  const supabase = createSupabaseServerClient({ request, responseHeaders, env });
  const code = url.searchParams.get("code");
  const next = getSafeNextPath(url.searchParams.get("next"));

  if (!code) {
    return redirectWithHeaders("/?auth_error=missing_code", responseHeaders);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Supabase callback failed:", error.message);
    return redirectWithHeaders("/?auth_error=callback_failed", responseHeaders);
  }

  return redirectWithHeaders(next, responseHeaders);
}

async function ensureAvatarsBucket(request: Request, env: SupabaseWorkerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  }

  const responseHeaders = new Headers({ "content-type": "application/json; charset=utf-8" });
  const user = await getAuthenticatedUser({ request, responseHeaders, env });
  if (!user) {
    return new Response(JSON.stringify({ error: "authentication_required" }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  const admin = createSupabaseAdminClient(env);
  if (!admin) {
    return new Response(JSON.stringify({ error: "storage_admin_not_configured" }), {
      status: 503,
      headers: responseHeaders,
    });
  }

  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    console.error("Could not list Supabase buckets:", listError.message);
    return new Response(JSON.stringify({ error: "storage_unavailable" }), {
      status: 502,
      headers: responseHeaders,
    });
  }

  if (!buckets?.some((bucket) => bucket.id === "avatars")) {
    const { error: createError } = await admin.storage.createBucket("avatars", {
      public: true,
      fileSizeLimit: "2MB",
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });

    if (createError) {
      console.error("Could not create avatars bucket:", createError.message);
      return new Response(JSON.stringify({ error: "bucket_creation_failed" }), {
        status: 502,
        headers: responseHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ ready: true }), { headers: responseHeaders });
}

async function authenticateProtectedRequest(
  request: Request,
  env: SupabaseWorkerEnv,
): Promise<{ request?: Request; response?: Response; responseHeaders: Headers }> {
  const responseHeaders = new Headers();
  const user = await getAuthenticatedUser({ request, responseHeaders, env });

  if (!user) {
    return {
      response: redirectWithHeaders("/?auth_error=login_required", responseHeaders),
      responseHeaders,
    };
  }

  // This header is created only after the server validates the Supabase token.
  // It lets the protected TanStack route receive a verified user during SSR.
  const headers = new Headers(request.headers);
  headers.delete("x-looma-authenticated-user");
  headers.set(
    "x-looma-authenticated-user",
    JSON.stringify({ id: user.id, email: user.email ?? null, name: user.user_metadata.full_name ?? null }),
  );

  return {
    request: new Request(request, { headers }),
    responseHeaders,
  };
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const workerEnv = env as SupabaseWorkerEnv;

      if (url.pathname === "/auth/callback") {
        return await handleAuthCallback(request, workerEnv);
      }

      if (url.pathname === "/api/storage/ensure-avatars") {
        return await ensureAvatarsBucket(request, workerEnv);
      }

      let requestForHandler = request;
      let authResponseHeaders: Headers | undefined;

      if (url.pathname === "/protegida") {
        const authentication = await authenticateProtectedRequest(request, workerEnv);
        if (authentication.response) return authentication.response;
        requestForHandler = authentication.request ?? request;
        authResponseHeaders = authentication.responseHeaders;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(requestForHandler, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      return authResponseHeaders
        ? appendResponseHeaders(normalizedResponse, authResponseHeaders)
        : normalizedResponse;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
