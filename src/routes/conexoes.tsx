import { audioManager } from "@/lib/audio-manager";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Search, UserRound, X } from "lucide-react";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { AdminVerifiedBadge } from "@/components/looma/AdminVerifiedBadge";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { AuthButton } from "@/components/looma/AuthButton";
import { type Profile, useCurrentProfile } from "@/lib/profile";
import { getConnectionRows, type ConnectionRow } from "@/lib/activity-metrics";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Connection = ConnectionRow;
type Tab = "accepted" | "received" | "sent";

export const Route = createFileRoute("/conexoes")({ component: ConnectionsPage });

function ConnectionsPage() {
  const { user, isLoading: isProfileLoading } = useCurrentProfile();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tab, setTab] = useState<Tab>("accepted");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingConnectionId, setUpdatingConnectionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setConnections([]);
      setProfiles({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: connectionError } = await getConnectionRows(supabase, userId);
      if (connectionError) {
        setError(connectionError.message);
        return;
      }
      const rows = (data ?? []) as Connection[];
      const ids = [
        ...new Set(
          rows.flatMap((row) => [row.requester_id, row.addressee_id]).filter((id) => id !== userId),
        ),
      ];
      if (ids.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, created_at, is_admin")
          .in("id", ids);
        if (profileError) {
          setError(profileError.message);
          return;
        }
        setProfiles(
          Object.fromEntries(
            ((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile]),
          ),
        );
      } else setProfiles({});
      setConnections(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar conexões.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      connections.filter((connection) => {
        if (!user) return false;
        if (tab === "accepted" && connection.status !== "accepted") return false;
        if (
          tab === "received" &&
          !(connection.status === "pending" && connection.addressee_id === user.id)
        )
          return false;
        if (
          tab === "sent" &&
          !(connection.status === "pending" && connection.requester_id === user.id)
        )
          return false;
        const peer =
          profiles[
            connection.requester_id === user.id ? connection.addressee_id : connection.requester_id
          ];
        return `${peer?.full_name ?? ""} ${peer?.username ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
      }),
    [connections, profiles, query, tab, user],
  );

  async function updateConnection(id: string, action: "accept" | "decline" | "cancel" | "remove") {
    if (!user || updatingConnectionId) return;
    setUpdatingConnectionId(id);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    try {
      const result =
        action === "accept"
          ? await supabase
              .from("connections")
              .update({ status: "accepted" })
              .eq("id", id)
              .eq("addressee_id", user.id)
              .eq("status", "pending")
          : action === "decline"
            ? await supabase
                .from("connections")
                .update({ status: "declined" })
                .eq("id", id)
                .eq("addressee_id", user.id)
                .eq("status", "pending")
            : action === "cancel"
              ? await supabase
                  .from("connections")
                  .delete()
                  .eq("id", id)
                  .eq("requester_id", user.id)
                  .eq("status", "pending")
              : await supabase.from("connections").delete().eq("id", id).eq("status", "accepted");
      if (result.error) {
        audioManager.play("error");
        setError(result.error.message);
      } else {
        audioManager.play(action === "accept" ? "follow" : "remove");
        await load();
      }
    } catch (caught) {
      audioManager.play("error");
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a conexão.");
    } finally {
      setUpdatingConnectionId(null);
    }
  }
  const labels: Record<Tab, string> = {
    accepted: "Minhas conexões",
    received: "Solicitações recebidas",
    sent: "Solicitações enviadas",
  };
  const emptyCopy =
    tab === "accepted"
      ? {
          title: "Você ainda não tem conexões",
          description: "Que tal se conectar? Conexões mudam vidas.",
          hasAction: true,
        }
      : tab === "received"
        ? {
            title: "Nenhuma solicitação recebida por enquanto.",
            description: "Quando alguém enviar uma solicitação, ela aparecerá aqui.",
            hasAction: false,
          }
        : {
            title: "Você ainda não enviou nenhuma solicitação.",
            description: "Encontre pessoas e inicie novas conexões.",
            hasAction: true,
          };

  if (isProfileLoading) {
    return (
      <WorkspaceLayout
        title="Conexões"
        description="Acompanhe as relações profissionais da sua conta."
      >
        <WorkspaceSkeleton cards={3} />
      </WorkspaceLayout>
    );
  }

  if (!user) {
    return (
      <WorkspaceLayout
        title="Conexões"
        description="Acompanhe as relações profissionais da sua conta."
      >
        <WorkspaceEmpty
          icon={UserRound}
          title="Entre para ver suas conexões"
          description="Faça login para acompanhar e criar conexões profissionais."
          action={<AuthButton />}
        />
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout
      title="Conexões"
      description="Acompanhe as relações profissionais da sua conta."
    >
      <div className="workspace-tabs">
        {(Object.keys(labels) as Tab[]).map((value) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {labels[value]}
          </button>
        ))}
      </div>
      <label className="workspace-search workspace-search-inline">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nas suas conexões"
        />
      </label>
      {loading ? (
        <WorkspaceSkeleton cards={3} />
      ) : error ? (
        <WorkspaceError
          icon={UserRound}
          title="Não foi possível carregar conexões"
          description={error}
          onRetry={() => void load()}
        />
      ) : visible.length === 0 ? (
        <WorkspaceEmpty
          icon={UserRound}
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={
            emptyCopy.hasAction ? (
              <Link to="/" className="workspace-empty-action">
                Conectar-se
              </Link>
            ) : null
          }
        />
      ) : (
        <section className="workspace-card-list">
          {visible.map((connection) => {
            const peerId =
              connection.requester_id === user?.id
                ? connection.addressee_id
                : connection.requester_id;
            const peer = profiles[peerId];
            return (
              <article className="workspace-person-card" key={connection.id}>
                <ProfileAvatar
                  className="workspace-avatar"
                  fullName={peer?.full_name ?? "Usuário"}
                  avatarUrl={peer?.avatar_url}
                />
                <div>
                  {peer?.username ? (
                    <Link
                      className="workspace-person-profile-link"
                      to="/perfil/$username"
                      params={{ username: peer.username.replace(/^@/, "") }}
                    >
                      <h2>
                        {peer.full_name || "Usuário"}
                        {peer.is_admin ? <AdminVerifiedBadge /> : null}
                      </h2>
                    </Link>
                  ) : (
                    <h2>
                      {peer?.full_name || "Usuário"}
                      {peer?.is_admin ? <AdminVerifiedBadge /> : null}
                    </h2>
                  )}
                  <p>
                    {peer?.username
                      ? `@${peer.username.replace(/^@/, "")}`
                      : "Sem username público"}
                  </p>
                </div>
                <div className="workspace-card-actions">
                  {tab === "received" ? (
                    <>
                      <button
                        className="workspace-primary-action"
                        disabled={updatingConnectionId !== null}
                        onClick={() => void updateConnection(connection.id, "accept")}
                      >
                        <Check size={16} />
                        {updatingConnectionId === connection.id ? "Atualizando…" : "Aceitar"}
                      </button>
                      <button
                        disabled={updatingConnectionId !== null}
                        onClick={() => void updateConnection(connection.id, "decline")}
                      >
                        <X size={16} /> Recusar
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={updatingConnectionId !== null}
                      onClick={() =>
                        void updateConnection(connection.id, tab === "sent" ? "cancel" : "remove")
                      }
                    >
                      {updatingConnectionId === connection.id
                        ? "Atualizando…"
                        : tab === "sent"
                          ? "Cancelar"
                          : "Remover"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </WorkspaceLayout>
  );
}
