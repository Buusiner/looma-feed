import { FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleHelp, Send } from "lucide-react";
import { WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { getProfileName, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/comunidade")({ component: CommunityPage });

function CommunityPage() {
  const { user, profile, isLoading } = useCurrentProfile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getProfileName(profile, user));
    setEmail(user?.email ?? "");
    setUsername(profile?.username ? `@${profile.username.replace(/^@/, "")}` : "");
  }, [profile, user]);

  async function sendTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !name.trim() || !email.trim() || !reason.trim() || !description.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    const supabase = getSupabaseBrowserClient();
    const { data: ticket, error: insertError } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim().replace(/^@/, "") || null,
        subject: reason.trim(),
        message: description.trim(),
      })
      .select("id")
      .single();
    if (insertError) setError(insertError.message);
    else {
      const { error: notificationError } = await supabase.functions.invoke(
        "notify-support-ticket",
        {
          body: { ticketId: ticket.id },
        },
      );
      if (notificationError) {
        console.error("[Looma] O suporte recebeu o ticket, mas o aviso por e-mail falhou.", {
          message: notificationError.message,
        });
      }
      setReason("");
      setDescription("");
      setNotice(
        notificationError
          ? "Sua solicitação foi registrada e já está disponível para a equipe no painel de suporte."
          : "Sua solicitação foi enviada para o suporte da Looma.",
      );
    }
    setSending(false);
  }
  return (
    <WorkspaceLayout
      title="Comunidade e Ajuda"
      description="Encontre orientações e entre em contato com o suporte da Looma."
    >
      {isLoading ? (
        <WorkspaceSkeleton cards={2} />
      ) : (
        <section className="workspace-section community-support-section">
          <header>
            <h2>Fale com o suporte</h2>
            <p>Conte o que aconteceu. A equipe da Looma receberá sua solicitação.</p>
          </header>
          {!user ? (
            <p className="workspace-helper" role="status">
              Entre com sua conta para enviar uma solicitação de suporte.
            </p>
          ) : null}
          {error ? (
            <WorkspaceError
              icon={CircleHelp}
              title="Não foi possível enviar a solicitação"
              description={error}
              onRetry={() => setError(null)}
            />
          ) : null}
          {notice ? <p className="workspace-notice">{notice}</p> : null}
          <form className="workspace-form" onSubmit={sendTicket}>
            <label>
              <span>Nome</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={!user || sending}
              />
            </label>
            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={!user || sending}
              />
            </label>
            <label>
              <span>Seu @ na Looma</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@seuperfil"
                disabled={!user || sending}
              />
            </label>
            <label>
              <span>Motivo do suporte</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Descreva o assunto em poucas palavras"
                required
                maxLength={120}
                disabled={!user || sending}
              />
            </label>
            <label>
              <span>O que aconteceu?</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                maxLength={1000}
                disabled={!user || sending}
              />
            </label>
            <button className="workspace-primary-action" disabled={!user || sending}>
              <Send size={16} /> {sending ? "Enviando…" : "Enviar solicitação"}
            </button>
          </form>
        </section>
      )}
    </WorkspaceLayout>
  );
}
