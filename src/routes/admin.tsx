import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { useAdminAccess } from "@/lib/admin";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type SupportTicket = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  subject: string;
  message: string;
  created_at: string;
};

type AdminDashboardMetrics = {
  profiles_count: number;
  posts_count: number;
  connections_count: number;
  proposals_count: number;
  support_tickets_count: number;
};

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isLoading: isProfileLoading } = useCurrentProfile();
  const { isAdmin, isLoading: isAdminLoading, error: accessError } = useAdminAccess(user);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingTickets(true);
    setTicketsError(null);
    const { data, error } = await getSupabaseBrowserClient()
      .from("support_tickets")
      .select("id, name, email, username, subject, message, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Looma] Não foi possível carregar as solicitações de suporte.", error);
      setTicketsError(error.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as SupportTicket[]);
    }
    setIsLoadingTickets(false);
  }, [isAdmin]);

  const loadMetrics = useCallback(async () => {
    if (!isAdmin) {
      setMetrics(null);
      setMetricsError(null);
      setIsLoadingMetrics(false);
      return;
    }

    setIsLoadingMetrics(true);
    setMetricsError(null);
    const { data, error } = await getSupabaseBrowserClient()
      .rpc("get_admin_dashboard_metrics")
      .single();

    if (error) {
      console.error("[Looma] Não foi possível carregar os indicadores administrativos.", error);
      setMetrics(null);
      setMetricsError(error.message);
    } else {
      setMetrics(data as AdminDashboardMetrics);
    }
    setIsLoadingMetrics(false);
  }, [isAdmin]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);
  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const isLoading = isProfileLoading || isAdminLoading;

  return (
    <WorkspaceLayout
      title="Administração"
      description="Acompanhe as solicitações enviadas para a equipe da Looma."
    >
      {isLoading ? (
        <WorkspaceSkeleton cards={3} />
      ) : !user ? (
        <WorkspaceEmpty
          icon={ShieldCheck}
          title="Área restrita"
          description="Entre com uma conta autorizada para acessar o conteúdo administrativo."
        />
      ) : accessError ? (
        <WorkspaceError
          icon={ShieldCheck}
          title="Não foi possível verificar seu acesso"
          description={accessError}
          onRetry={() => window.location.reload()}
        />
      ) : !isAdmin ? (
        <WorkspaceEmpty
          icon={ShieldCheck}
          title="Área restrita"
          description="Sua conta não possui acesso ao conteúdo administrativo."
        />
      ) : (
        <>
          {isLoadingMetrics ? (
            <WorkspaceSkeleton cards={5} />
          ) : metricsError ? (
            <WorkspaceError
              icon={ShieldCheck}
              title="Não foi possível carregar os indicadores administrativos"
              description={metricsError}
              onRetry={() => void loadMetrics()}
            />
          ) : metrics ? (
            <section className="workspace-metrics" aria-label="Indicadores administrativos">
              <article>
                <span>Perfis</span>
                <strong>{metrics.profiles_count}</strong>
                <small>Contas com perfil criado</small>
              </article>
              <article>
                <span>Publicações</span>
                <strong>{metrics.posts_count}</strong>
                <small>Publicações disponíveis</small>
              </article>
              <article>
                <span>Conexões</span>
                <strong>{metrics.connections_count}</strong>
                <small>Relações aceitas</small>
              </article>
              <article>
                <span>Propostas</span>
                <strong>{metrics.proposals_count}</strong>
                <small>Propostas registradas</small>
              </article>
              <article>
                <span>Suporte</span>
                <strong>{metrics.support_tickets_count}</strong>
                <small>Solicitações recebidas</small>
              </article>
            </section>
          ) : null}

          {isLoadingTickets ? (
            <WorkspaceSkeleton cards={3} />
          ) : ticketsError ? (
            <WorkspaceError
              icon={LifeBuoy}
              title="Não foi possível carregar as solicitações"
              description={ticketsError}
              onRetry={() => void loadTickets()}
            />
          ) : tickets.length === 0 ? (
            <WorkspaceEmpty
              icon={LifeBuoy}
              title="Nenhuma solicitação de suporte"
              description="As mensagens enviadas pela Comunidade e Ajuda aparecerão aqui."
            />
          ) : (
            <section className="workspace-card-list" aria-label="Solicitações de suporte">
              {tickets.map((ticket) => (
                <article className="workspace-card" key={ticket.id}>
                  <div className="workspace-card-heading">
                    <div>
                      <span className="workspace-status">Suporte</span>
                      <h2>{ticket.subject}</h2>
                      <p className="workspace-card-counterparty">
                        <strong>{ticket.name}</strong>
                        {ticket.username ? ` · @${ticket.username.replace(/^@/, "")}` : ""}
                      </p>
                    </div>
                    <time>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(ticket.created_at))}
                    </time>
                  </div>
                  <p>{ticket.message}</p>
                  {ticket.email ? <small>{ticket.email}</small> : null}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </WorkspaceLayout>
  );
}
