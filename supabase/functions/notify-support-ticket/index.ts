import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@^6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_EMAIL = "suporteloomaapp@gmail.com";

type SupportTicketRequest = {
  ticketId?: unknown;
};

type SupportTicket = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  subject: string;
  message: string;
  created_at: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Looma <onboarding@resend.dev>";

  if (!authorization || !supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  if (!resendApiKey || resendApiKey === "re_xxxxxxxxx") {
    return Response.json(
      { error: "Email provider is not configured" },
      { status: 503, headers: corsHeaders },
    );
  }

  const payload = (await request.json().catch(() => null)) as SupportTicketRequest | null;
  const ticketId = typeof payload?.ticketId === "string" ? payload.ticketId : "";
  if (!ticketId) {
    return Response.json({ error: "ticketId is required" }, { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, name, email, username, subject, message, created_at")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ticketError || !ticket) {
    return Response.json(
      { error: "Support ticket not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  const supportTicket = ticket as SupportTicket;
  const senderName = escapeHtml(supportTicket.name);
  const senderEmail = escapeHtml(supportTicket.email ?? "Não informado");
  const senderUsername = escapeHtml(
    supportTicket.username ? `@${supportTicket.username.replace(/^@/, "")}` : "Não informado",
  );
  const subject = escapeHtml(supportTicket.subject);
  const message = escapeHtml(supportTicket.message).replace(/\n/g, "<br />");
  const submittedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(supportTicket.created_at));

  const resend = new Resend(resendApiKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: [SUPPORT_EMAIL],
    subject: `[Looma] Novo pedido de suporte: ${supportTicket.subject}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px;color:#1a1a1a"><div style="font-size:24px;font-weight:700;color:#ff6b4a">looma</div><h1 style="font-size:22px;margin:28px 0 8px">Novo pedido de suporte</h1><p style="color:#6b6b6b;line-height:1.6">${submittedAt}</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><tr><td style="padding:10px 0;color:#6b6b6b;width:130px">Nome</td><td style="padding:10px 0;font-weight:600">${senderName}</td></tr><tr><td style="padding:10px 0;color:#6b6b6b">E-mail</td><td style="padding:10px 0;font-weight:600">${senderEmail}</td></tr><tr><td style="padding:10px 0;color:#6b6b6b">Looma</td><td style="padding:10px 0;font-weight:600">${senderUsername}</td></tr><tr><td style="padding:10px 0;color:#6b6b6b">Motivo</td><td style="padding:10px 0;font-weight:600">${subject}</td></tr></table><div style="padding:18px;border-radius:12px;background:#fff1ed;line-height:1.6">${message}</div></div>`,
    text: `Novo pedido de suporte\n\nNome: ${supportTicket.name}\nE-mail: ${supportTicket.email ?? "Não informado"}\nLooma: ${supportTicket.username ? `@${supportTicket.username}` : "Não informado"}\nMotivo: ${supportTicket.subject}\n\n${supportTicket.message}`,
  });

  if (sendError) {
    console.error("Não foi possível enviar o aviso de suporte:", sendError);
    return Response.json(
      { error: "Unable to send support email" },
      { status: 502, headers: corsHeaders },
    );
  }

  return Response.json({ delivered: true }, { headers: corsHeaders });
});
