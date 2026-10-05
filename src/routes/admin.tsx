import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, LifeBuoy, Search, ShieldCheck, UserRound } from "lucide-react";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
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

type AdminProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  is_admin: boolean;
};

type AdminDashboardMetrics = {
  profiles_count: number;
  posts_count: number;
  connections_count: number;
  proposals_count: number;
  support_tickets_count: number;
};

const ADMIN_NAV = [
  { label: "Visão geral", icon: BadgeCheck, href: "#top" },
  { label: "Usuários", icon: UserRound, href: "#admin-profiles-title" },
  { label: "Suporte", icon: LifeBuoy, href: "#admin-support-title" },
];

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, profile, isLoading: isProfileLoading } = useCurrentProfile();
  const { isAdmin, isLoading: isAdminLoading, error: accessError } = useAdminAccess(user);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "pending" | "admin">("all");
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
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
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      console.error("[Looma] Não foi possível carregar as solicitações de suporte.", error);
      setTicketsError(error.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as SupportTicket[]);
    }
    setIsLoadingTickets(false);
  }, [isAdmin]);

  const loadProfiles = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingProfiles(true);
    setProfilesError(null);
    const { data, error } = await getSupabaseBrowserClient()
      .from("profiles")
      .select("id, full_name, username, created_at, onboarding_completed_at, is_admin")
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      console.error("[Looma] Não foi possível carregar os perfis administrativos.", error);
      setProfilesError(error.message);
      setProfiles([]);
    } else {
      setProfiles((data ?? []) as AdminProfile[]);
    }
    setIsLoadingProfiles(false);
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
    void loadProfiles();
    void loadMetrics();
  }, [loadMetrics, loadProfiles, loadTickets]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles.filter((profileItem) => {
      const matchesQuery =
        !normalizedQuery ||
        profileItem.full_name?.toLowerCase().includes(normalizedQuery) ||
        profileItem.username?.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "complete" && profileItem.onboarding_completed_at) ||
        (statusFilter === "pending" && !profileItem.onboarding_completed_at) ||
        (statusFilter === "admin" && profileItem.is_admin);

      return matchesQuery && matchesStatus;
    });
  }, [profiles, query, statusFilter]);

  const isLoading = isProfileLoading || isAdminLoading;

  if (isLoading) {
    return (
      <AdminLayout profileName={profile?.full_name ?? user?.email ?? "Admin"}>
        <WorkspaceSkeleton cards={5} />
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout profileName="Admin">
        <WorkspaceEmpty
          icon={ShieldCheck}
          title="Área restrita"
          description="Entre com uma conta autorizada para acessar o conteúdo administrativo."
        />
      </AdminLayout>
    );
  }

  if (accessError) {
    return (
      <AdminLayout profileName={profile?.full_name ?? user.email ?? "Admin"}>
        <WorkspaceError
          icon={ShieldCheck}
          title="Não foi possível verificar seu acesso"
          description={accessError}
          onRetry={() => window.location.reload()}
        />
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout profileName={profile?.full_name ?? user.email ?? "Admin"}>
        <WorkspaceEmpty
          icon={ShieldCheck}
          title="Área restrita"
          description="Sua conta não possui acesso ao conteúdo administrativo."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout profileName={profile?.full_name ?? user.email ?? "Admin"}>
      <header className="admin-section-header">
        <div>
          <h1>Visão geral</h1>
          <p>Operação da Looma em tempo real.</p>
        </div>
      </header>

      {isLoadingMetrics ? (
        <WorkspaceSkeleton cards={5} />
      ) : metricsError ? (
        <WorkspaceError
          icon={ShieldCheck}
          title="Não foi possível carregar indicadores"
          description={metricsError}
          onRetry={() => void loadMetrics()}
        />
      ) : metrics ? (
        <section className="admin-kpi-grid" aria-label="Indicadores administrativos">
          <AdminKpi label="Perfis" value={metrics.profiles_count} />
          <AdminKpi label="Publicações" value={metrics.posts_count} />
          <AdminKpi label="Conexões" value={metrics.connections_count} />
          <AdminKpi label="Propostas" value={metrics.proposals_count} />
          <AdminKpi label="Suporte" value={metrics.support_tickets_count} />
        </section>
      ) : null}

      <section className="admin-panel" aria-labelledby="admin-support-title">
        <div className="admin-panel-header">
          <div>
            <h2 id="admin-support-title">Solicitações de suporte</h2>
            <p>Pedidos enviados por Comunidade e Ajuda.</p>
          </div>
          <button type="button" onClick={() => void loadTickets()}>
            Atualizar
          </button>
        </div>
        {isLoadingTickets ? (
          <WorkspaceSkeleton cards={3} />
        ) : ticketsError ? (
          <WorkspaceError
            icon={LifeBuoy}
            title="Não foi possível carregar solicitações"
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
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Usuário</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.subject}</strong>
                      <small>{ticket.message}</small>
                    </td>
                    <td>
                      {ticket.name}
                      <small>
                        {ticket.username ? `@${ticket.username.replace(/^@/, "")}` : ticket.email}
                      </small>
                    </td>
                    <td>{formatDate(ticket.created_at)}</td>
                    <td>
                      <a href={`mailto:${ticket.email ?? ""}`}>Responder</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="admin-profiles-title">
        <div className="admin-panel-header">
          <div>
            <h2 id="admin-profiles-title">Perfis recentes</h2>
            <p>Últimos perfis cadastrados na Looma.</p>
          </div>
          <label className="admin-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar perfis"
              aria-label="Buscar perfis"
            />
          </label>
        </div>
        <div className="admin-filters" aria-label="Filtrar perfis">
          {[
            ["all", "Todos"],
            ["complete", "Com onboarding"],
            ["pending", "Pendentes"],
            ["admin", "Admins"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={statusFilter === value ? "active" : ""}
              onClick={() => setStatusFilter(value as typeof statusFilter)}
            >
              {label}
            </button>
          ))}
        </div>
        {isLoadingProfiles ? (
          <WorkspaceSkeleton cards={3} />
        ) : profilesError ? (
          <WorkspaceError
            icon={UserRound}
            title="Não foi possível carregar perfis"
            description={profilesError}
            onRetry={() => void loadProfiles()}
          />
        ) : filteredProfiles.length === 0 ? (
          <WorkspaceEmpty
            icon={UserRound}
            title="Nenhum perfil encontrado"
            description="Ajuste os filtros para ver outros perfis."
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Função</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((profileItem) => (
                  <tr key={profileItem.id}>
                    <td>
                      <strong>{profileItem.full_name || "Usuário"}</strong>
                      <small>
                        {profileItem.username
                          ? `@${profileItem.username.replace(/^@/, "")}`
                          : "Sem usuário"}
                      </small>
                    </td>
                    <td>
                      <span className="admin-status-badge">
                        {profileItem.onboarding_completed_at ? "Ativo" : "Pendente"}
                      </span>
                    </td>
                    <td>{formatDate(profileItem.created_at)}</td>
                    <td>{profileItem.is_admin ? "Admin" : "Usuário"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="admin-pagination-note">
              Exibindo {filteredProfiles.length} de {profiles.length} perfis recentes.
            </p>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

function AdminLayout({ children, profileName }: { children: ReactNode; profileName: string }) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          <span className="looma-logo-mark" aria-hidden="true" /> Looma Admin
        </Link>
        <nav aria-label="Administração">
          {ADMIN_NAV.map(({ label, icon: Icon, href }, index) => (
            <a href={href} className={index === 0 ? "active" : ""} key={label}>
              <Icon size={15} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <section className="admin-main" id="top">
        <header className="admin-topbar">
          <Link to="/">Voltar ao app</Link>
          <span>{profileName}</span>
        </header>
        <div className="admin-content">{children}</div>
      </section>
    </main>
  );
}

function AdminKpi({ label, value }: { label: string; value: number }) {
  return (
    <article className="admin-kpi">
      <span>{label}</span>
      <strong>{value.toLocaleString("pt-BR")}</strong>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
