import { Webhook } from "npm:standardwebhooks@^1";
import { Resend } from "npm:resend@^6";

type SendEmailPayload = {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    email_action_type: string;
  };
};

function getSubject(action: string) {
  if (action === "recovery") return "Recupere o acesso à Looma";
  if (action === "email_change") return "Confirme o seu novo email";
  return "O seu código de acesso à Looma";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const hookSecretValue = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Looma <onboarding@resend.dev>";

  if (!resendApiKey || resendApiKey === "re_xxxxxxxxx" || !hookSecretValue) {
    return Response.json(
      { error: { http_code: 503, message: "Email provider is not configured" } },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);
  const webhook = new Webhook(hookSecretValue.replace("v1,whsec_", ""));

  try {
    const { user, email_data: emailData } = webhook.verify(payload, headers) as SendEmailPayload;
    const spacedCode = emailData.token.split("").join(" ");
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from,
      to: [user.email],
      subject: getSubject(emailData.email_action_type),
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a1a"><div style="font-size:24px;font-weight:700;color:#ff6b4a">looma</div><h1 style="font-size:22px;margin:28px 0 8px">Entre na sua conta</h1><p style="color:#6b6b6b;line-height:1.6">Use este código de verificação para continuar:</p><div style="margin:28px 0;padding:18px;border-radius:12px;background:#fff1ed;color:#1a1a1a;font-size:30px;font-weight:700;letter-spacing:8px;text-align:center">${spacedCode}</div><p style="color:#6b6b6b;font-size:13px;line-height:1.6">Se não pediu este código, pode ignorar este email.</p></div>`,
      text: `O seu código de acesso à Looma é ${emailData.token}. Se não pediu este código, pode ignorar este email.`,
    });

    if (error) throw error;
    return Response.json({});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send authentication email";
    return Response.json(
      { error: { http_code: 401, message } },
      { status: 401 },
    );
  }
});
