import { audioManager } from "@/lib/audio-manager";
import { useCallback, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, FileSignature, X } from "lucide-react";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { AuthButton } from "@/components/looma/AuthButton";
import { AdminVerifiedBadge } from "@/components/looma/AdminVerifiedBadge";
import { type Profile, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Proposal = {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  message: string;
  post_id: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};
type Tab = "sent" | "received";
export const Route = createFileRoute("/propostas")({ component: ProposalsPage });

function ProposalsPage() {
  const { user, isLoading: isProfileLoading } = useCurrentProfile();
  const [tab, setTab] = useState<Tab>("sent");
  const [items, setItems] = useState<Proposal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setItems([]);
      setProfiles({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const field = tab === "sent" ? "sender_id" : "recipient_id";
      const { data, error: queryError } = await getSupabaseBrowserClient()
        .from("proposals")
        .select("id, sender_id, recipient_id, title, message, post_id, status, created_at")
        .eq(field, userId)
        .order("created_at", { ascending: false });
      if (queryError) {
        setError(queryError.message);
        setProfiles({});
        return;
      }

      const proposalRows = (data ?? []) as Proposal[];
      const profileIds = [
        ...new Set(
          proposalRows
            .map((proposal) => (tab === "sent" ? proposal.recipient_id : proposal.sender_id))
            .filter((profileId) => profileId !== userId),
        ),
      ];
      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await getSupabaseBrowserClient()
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, created_at, is_admin")
          .in("id", profileIds);
        if (profileError) {
          setError(profileError.message);
          setProfiles({});
          return;
        }
        setProfiles(
          Object.fromEntries(
            ((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile]),
          ),
        );
      } else {
        setProfiles({});
      }
      setItems(proposalRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar propostas.");
      setProfiles({});
    } finally {
      setLoading(false);
    }
  }, [tab, user?.id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function respond(id: string, status: "accepted" | "declined") {
    if (!user || processingProposalId) return;
    setProcessingProposalId(id);
    setError(null);
    try {
      const { error: updateError } = await getSupabaseBrowserClient()
        .from("proposals")
        .update({ status })
        .eq("id", id)
        .eq("recipient_id", user.id)
        .eq("status", "pending");
      if (updateError) {
        audioManager.play("error");
        setError(updateError.message);
      } else {
        audioManager.play(status === "accepted" ? "success" : "remove");
        await load();
      }
    } catch (caught) {
      audioManager.play("error");
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a proposta.");
    } finally {
      setProcessingProposalId(null);
    }
  }

  async function cancel(id: string) {
    if (!user || processingProposalId) return;
    setProcessingProposalId(id);
    setError(null);
    try {
      const { error: deleteError } = await getSupabaseBrowserClient()
        .from("proposals")
        .delete()
        .eq("id", id)
        .eq("sender_id", user.id)
        .eq("status", "pending");
      if (deleteError) {
        audioManager.play("error");
        setError(deleteError.message);
      } else {
        audioManager.play("remove");
        await load();
      }
    } catch (caught) {
      audioManager.play("error");
      setError(caught instanceof Error ? caught.message : "Não foi possível cancelar a proposta.");
    } finally {
      setProcessingProposalId(null);
    }
  }
  const statusLabel = { pending: "Pendente", accepted: "Aceita", declined: "Recusada" } as const;

  if (isProfileLoading) {
    return (
      <WorkspaceLayout
        title="Propostas"
        description="Acompanhe as propostas enviadas e recebidas pela sua conta."
      >
        <WorkspaceSkeleton cards={3} />
      </WorkspaceLayout>
    );
  }

  if (!user) {
    return (
      <WorkspaceLayout
        title="Propostas"
        description="Acompanhe as propostas enviadas e recebidas pela sua conta."
      >
        <WorkspaceEmpty
          icon={FileSignature}
          title="Entre para consultar propostas"
          description="Faça login para acompanhar as propostas enviadas e recebidas."
          action={<AuthButton />}
        />
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout
      title="Propostas"
      description="Acompanhe as propostas enviadas e recebidas pela sua conta."
    >
      <div className="workspace-tabs">
        <button className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}>
          Enviadas
        </button>
        <button className={tab === "received" ? "active" : ""} onClick={() => setTab("received")}>
          Recebidas
        </button>
      </div>
      {loading ? (
        <WorkspaceSkeleton cards={3} />
      ) : error ? (
        <WorkspaceError
          icon={FileSignature}
          title="Não foi possível carregar propostas"
          description={error}
          onRetry={() => void load()}
        />
      ) : items.length === 0 ? (
        <WorkspaceEmpty
          icon={FileSignature}
          title={tab === "sent" ? "Nenhuma proposta enviada" : "Nenhuma proposta recebida"}
          description="Quando houver propostas, elas aparecerão aqui."
          action={
            <Link to="/conexoes" className="workspace-empty-action">
              Explorar conexões
            </Link>
          }
        />
      ) : (
        <section className="workspace-card-list">
          {items.map((item) => (
            <article className="workspace-card" key={item.id}>
              <div className="workspace-card-heading">
                <div>
                  <span className={`workspace-status ${item.status}`}>
                    {statusLabel[item.status]}
                  </span>
                  <h2>{item.title}</h2>
                  <p className="workspace-card-counterparty">
                    {tab === "sent" ? "Enviada para " : "Recebida de "}
                    <strong>
                      {profiles[tab === "sent" ? item.recipient_id : item.sender_id]?.full_name ??
                        "Usuário"}
                      {profiles[tab === "sent" ? item.recipient_id : item.sender_id]?.is_admin ? (
                        <AdminVerifiedBadge />
                      ) : null}
                    </strong>
                  </p>
                </div>
                <time>
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                    new Date(item.created_at),
                  )}
                </time>
              </div>
              <p>{item.message || "Sem mensagem adicional."}</p>
              {tab === "received" && item.status === "pending" ? (
                <div className="workspace-card-actions">
                  <button
                    className="workspace-primary-action"
                    disabled={processingProposalId !== null}
                    onClick={() => void respond(item.id, "accepted")}
                  >
                    <Check size={16} />
                    {processingProposalId === item.id ? "Atualizando…" : "Aceitar"}
                  </button>
                  <button
                    disabled={processingProposalId !== null}
                    onClick={() => void respond(item.id, "declined")}
                  >
                    <X size={16} /> Recusar
                  </button>
                </div>
              ) : null}
              {tab === "sent" && item.status === "pending" ? (
                <div className="workspace-card-actions">
                  <button
                    disabled={processingProposalId !== null}
                    onClick={() => void cancel(item.id)}
                  >
                    {processingProposalId === item.id ? "Cancelando…" : "Cancelar proposta"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </WorkspaceLayout>
  );
}
