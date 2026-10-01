import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bell, FileSignature, Heart, MessageCircle, Repeat2, UserPlus } from "lucide-react";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { AdminVerifiedBadge } from "@/components/looma/AdminVerifiedBadge";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { type Profile, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  markNotificationEventsAsRead,
  type NotificationEvent,
  type NotificationEventType,
} from "@/lib/notifications";

type ConnectionNotification = {
  id: string;
  requester_id: string;
  created_at: string;
};

type ProposalNotification = {
  id: string;
  sender_id: string;
  title: string;
  message: string;
  created_at: string;
};

type NotificationItem =
  | {
      id: string;
      kind: "event";
      eventType: NotificationEventType;
      actorId: string | null;
      title: string;
      body: string;
      createdAt: string;
      isUnread: boolean;
    }
  | {
      id: string;
      kind: "connection";
      actorId: string;
      title: string;
      body: string;
      createdAt: string;
      isUnread: true;
    }
  | {
      id: string;
      kind: "proposal";
      actorId: string;
      title: string;
      body: string;
      createdAt: string;
      isUnread: true;
    };

export const Route = createFileRoute("/notificacoes")({ component: NotificationsPage });

function getNotificationIcon(item: NotificationItem) {
  if (item.kind === "connection") return UserPlus;
  if (item.kind === "proposal") return FileSignature;
  if (item.eventType === "like") return Heart;
  if (item.eventType === "comment") return MessageCircle;
  if (item.eventType === "repost" || item.eventType === "retweet") return Repeat2;
  return Bell;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function NotificationsPage() {
  const { user } = useCurrentProfile();
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [connections, setConnections] = useState<ConnectionNotification[]>([]);
  const [proposals, setProposals] = useState<ProposalNotification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setEvents([]);
      setConnections([]);
      setProposals([]);
      setProfiles({});
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    try {
      const [eventResult, connectionResult, proposalResult] = await Promise.all([
        supabase
          .from("notification_events")
          .select(
            "id, user_id, actor_id, type, title, body, source_type, source_id, is_read, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("connections")
          .select("id, requester_id, created_at")
          .eq("addressee_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("proposals")
          .select("id, sender_id, title, message, created_at")
          .eq("recipient_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      const errors = [eventResult.error, connectionResult.error, proposalResult.error]
        .filter((resultError): resultError is NonNullable<typeof resultError> =>
          Boolean(resultError),
        )
        .map((resultError) => resultError.message);

      if (errors.length) {
        setError(errors.join(" "));
        return;
      }

      const eventRows = (eventResult.data ?? []) as NotificationEvent[];
      const connectionRows = (connectionResult.data ?? []) as ConnectionNotification[];
      const proposalRows = (proposalResult.data ?? []) as ProposalNotification[];
      const profileIds = [
        ...new Set(
          [
            ...eventRows.map((event) => event.actor_id),
            ...connectionRows.map((connection) => connection.requester_id),
            ...proposalRows.map((proposal) => proposal.sender_id),
          ].filter(Boolean) as string[],
        ),
      ];

      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, created_at, is_admin")
          .in("id", profileIds);
        if (profileError) {
          setError(profileError.message);
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

      setEvents(eventRows);
      setConnections(connectionRows);
      setProposals(proposalRows);

      if (eventRows.some((event) => !event.is_read)) {
        const { error: readError } = await markNotificationEventsAsRead(supabase, userId);
        if (readError) {
          console.error("[Looma] Não foi possível marcar notificações como lidas.", readError);
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível carregar notificações.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo<NotificationItem[]>(() => {
    const eventItems: NotificationItem[] = events.map((event) => ({
      id: event.id,
      kind: "event",
      eventType: event.type,
      actorId: event.actor_id,
      title: event.title,
      body: event.body,
      createdAt: event.created_at,
      isUnread: !event.is_read,
    }));
    const connectionItems: NotificationItem[] = connections.map((connection) => {
      const actor = profiles[connection.requester_id];
      return {
        id: `connection-${connection.id}`,
        kind: "connection",
        actorId: connection.requester_id,
        title: "Nova solicitação de conexão",
        body: `${actor?.full_name ?? "Alguém"} quer se conectar com você.`,
        createdAt: connection.created_at,
        isUnread: true,
      };
    });
    const proposalItems: NotificationItem[] = proposals.map((proposal) => {
      const actor = profiles[proposal.sender_id];
      return {
        id: `proposal-${proposal.id}`,
        kind: "proposal",
        actorId: proposal.sender_id,
        title: "Nova proposta recebida",
        body: `${actor?.full_name ?? "Alguém"} enviou uma proposta: ${proposal.title}`,
        createdAt: proposal.created_at,
        isUnread: true,
      };
    });
    return [...connectionItems, ...proposalItems, ...eventItems].sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [connections, events, profiles, proposals]);

  return (
    <WorkspaceLayout
      title="Notificações"
      description="Acompanhe curtidas, comentários, reposts, solicitações e propostas."
    >
      {loading ? (
        <WorkspaceSkeleton cards={4} />
      ) : error ? (
        <WorkspaceError
          icon={Bell}
          title="Não foi possível carregar notificações"
          description={error}
          onRetry={() => void load()}
        />
      ) : items.length === 0 ? (
        <WorkspaceEmpty
          icon={Bell}
          title={user ? "Nenhuma notificação por enquanto" : "Entre com sua conta"}
          description={
            user
              ? "Quando alguém curtir, comentar, repostar, enviar proposta ou solicitar conexão, aparecerá aqui."
              : "Entre com sua conta para ver suas notificações."
          }
          action={
            user ? (
              <Link to="/" className="workspace-empty-action">
                Voltar ao início
              </Link>
            ) : null
          }
        />
      ) : (
        <section className="workspace-card-list notifications-list">
          {items.map((item) => {
            const Icon = getNotificationIcon(item);
            const actor = item.actorId ? profiles[item.actorId] : null;
            return (
              <article
                className={`workspace-card notification-card ${item.isUnread ? "is-unread" : ""}`}
                key={item.id}
              >
                <div className="notification-card-icon">
                  {actor ? (
                    <ProfileAvatar
                      className="workspace-avatar"
                      fullName={actor.full_name ?? "Usuário"}
                      avatarUrl={actor.avatar_url}
                    />
                  ) : (
                    <Icon size={20} aria-hidden="true" />
                  )}
                </div>
                <div className="notification-card-copy">
                  <div className="notification-card-heading">
                    <h2>{item.title}</h2>
                    {item.isUnread ? <span>Nova</span> : null}
                  </div>
                  {actor ? (
                    <strong className="notification-card-actor">
                      {actor.full_name ?? actor.username ?? "Usuário"}
                      {actor.is_admin ? <AdminVerifiedBadge /> : null}
                    </strong>
                  ) : null}
                  <p>{item.body}</p>
                  <time>{formatNotificationDate(item.createdAt)}</time>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </WorkspaceLayout>
  );
}
