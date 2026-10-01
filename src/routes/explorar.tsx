import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Compass,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { AdminVerifiedBadge } from "@/components/looma/AdminVerifiedBadge";
import { LoomaSidebar } from "@/components/looma/Sidebar";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { type Profile, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ExploreTab = "explore" | "trending" | "news" | "projects";

type OpportunityPreview = {
  id: string;
  title: string;
  description: string;
  type: string | null;
  category: string | null;
  work_mode: string | null;
};

const EXPLORE_NEWS = [
  {
    id: "looma-studio",
    title: "Criadores estão montando miniestúdios para vender serviços completos",
    meta: "Hoje · Criatividade · 428 conversas",
  },
  {
    id: "portfolio-live",
    title: "Portfólios vivos ganham espaço entre freelancers e equipes pequenas",
    meta: "2 h · Portfólio · 319 conversas",
  },
  {
    id: "ia-operacoes",
    title: "Profissionais de operações usam IA para acelerar propostas e entregas",
    meta: "4 h · Produtividade · 612 conversas",
  },
];

const EXPLORE_TRENDS = [
  ["Design · Em alta", "Identidade para marcas pequenas"],
  ["Tecnologia · Em alta", "Automação sem código"],
  ["Marketing · Em alta", "Campanhas de lançamento"],
  ["Dados · Em alta", "Dashboards para negócios locais"],
  ["Brasil · Crescendo", "Comunidades profissionais independentes"],
];

const EXPLORE_AREAS = [
  "Designer UI/UX",
  "Editor de vídeo",
  "Social media",
  "Desenvolvedor front-end",
  "Analista de dados",
  "Gestor de tráfego",
];

const EXPLORE_QUERY_TIMEOUT_MS = 3500;
const EXPLORE_PROFILES_LIMIT = 200;

function createExploreAbortSignal() {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(EXPLORE_QUERY_TIMEOUT_MS);
  }

  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), EXPLORE_QUERY_TIMEOUT_MS);
  return controller.signal;
}

function isDiscoverableProfile(profile: Profile, currentUserId: string | undefined) {
  if (currentUserId && profile.id === currentUserId) return false;
  return Boolean(profile.full_name?.trim() || profile.username?.trim());
}

function getExploreProfileName(profile: Profile) {
  return profile.full_name?.trim() || profile.username?.trim() || "Conta Looma";
}

function getExploreProfileUsername(profile: Profile) {
  const username = profile.username?.trim();
  return username ? `@${username.replace(/^@/, "")}` : "Perfil";
}

function shuffleProfiles(profiles: Profile[]) {
  const nextProfiles = [...profiles];

  for (let index = nextProfiles.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentProfile = nextProfiles[index];
    const randomProfile = nextProfiles[randomIndex];
    if (!currentProfile || !randomProfile) continue;
    [nextProfiles[index], nextProfiles[randomIndex]] = [randomProfile, currentProfile];
  }

  return nextProfiles;
}

export const Route = createFileRoute("/explorar")({ component: ExplorePage });

function ExplorePage() {
  const { profile, user } = useCurrentProfile();
  const [tab, setTab] = useState<ExploreTab>("explore");
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityPreview[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setProfilesError(null);

    try {
      const queryBuilder = getSupabaseBrowserClient()
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, bio, created_at, onboarding_completed_at, experience_level, is_admin",
        )
        .order("created_at", { ascending: false })
        .limit(EXPLORE_PROFILES_LIMIT);

      const request = user?.id ? queryBuilder.neq("id", user.id) : queryBuilder;
      const { data, error } = await request.abortSignal(createExploreAbortSignal());

      if (error) {
        setProfilesError(error.message);
        setProfiles([]);
      } else {
        const currentProfileId = profile?.id || user?.id;
        const discoverableProfiles = ((data ?? []) as Profile[]).filter((profile) =>
          isDiscoverableProfile(profile, currentProfileId),
        );
        setProfiles(shuffleProfiles(discoverableProfiles));
      }
    } catch (error) {
      setProfilesError(
        error instanceof Error ? error.message : "Não foi possível carregar contas.",
      );
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, [profile?.id, user?.id]);

  const loadOpportunities = useCallback(async () => {
    setLoadingOpportunities(true);
    setOpportunitiesError(null);

    try {
      const { data, error } = await getSupabaseBrowserClient()
        .from("opportunities")
        .select("id, title, description, type, category, work_mode")
        .order("created_at", { ascending: false })
        .limit(2)
        .abortSignal(createExploreAbortSignal());

      if (error) {
        setOpportunitiesError(error.message);
        setOpportunities([]);
      } else {
        setOpportunities((data ?? []) as OpportunityPreview[]);
      }
    } catch (error) {
      setOpportunitiesError(
        error instanceof Error ? error.message : "Não foi possível carregar oportunidades.",
      );
      setOpportunities([]);
    } finally {
      setLoadingOpportunities(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
    void loadOpportunities();
  }, [loadOpportunities, loadProfiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");
    if (!normalizedQuery) return profiles;
    return profiles.filter((profile) =>
      `${profile.full_name ?? ""} ${profile.username ?? ""} ${profile.bio ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [profiles, query]);

  return (
    <main className="feed-stage explore-page">
      <LoomaSidebar />
      <div className="home-shell explore-shell">
        <div className="home-main-scroll">
          <section className="home-feed-stream explore-feed-stream" aria-label="Explorar">
            <div className="feed-column home-feed-panel explore-main">
              <label className="explore-search">
                <Search size={18} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar na Looma"
                />
              </label>

              <nav className="explore-tabs" aria-label="Categorias de exploração">
                {[
                  ["explore", "Explorar"],
                  ["trending", "Em alta"],
                  ["news", "Novidades"],
                  ["projects", "Projetos"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={tab === value ? "active" : ""}
                    onClick={() => setTab(value as ExploreTab)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <section className="explore-news-card">
                <div className="explore-section-heading">
                  <h1>Novidades para descobrir</h1>
                  <Sparkles size={18} aria-hidden="true" />
                </div>
                {EXPLORE_NEWS.map((item) => (
                  <article key={item.id} className="explore-news-item">
                    <h2>{item.title}</h2>
                    <p>{item.meta}</p>
                  </article>
                ))}
              </section>

              <section className="explore-trends-list" aria-label="Assuntos em alta">
                {EXPLORE_TRENDS.map(([meta, title]) => (
                  <article key={title}>
                    <div>
                      <span>{meta}</span>
                      <h2>{title}</h2>
                    </div>
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </article>
                ))}
              </section>

              <section className="explore-people-section" aria-labelledby="explore-people-title">
                <div className="explore-section-heading">
                  <h2 id="explore-people-title">Contas para conhecer</h2>
                  <Link to="/conexoes">Ver rede</Link>
                </div>
                {loadingProfiles ? (
                  <div className="explore-profile-skeleton" aria-label="Carregando contas">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : profilesError ? (
                  <p className="explore-state">Não foi possível carregar contas: {profilesError}</p>
                ) : filteredProfiles.length ? (
                  <div className="explore-profile-list">
                    {filteredProfiles.map((profile) => (
                      <article key={profile.id}>
                        <ProfileAvatar
                          className="avatar"
                          fullName={getExploreProfileName(profile)}
                          avatarUrl={profile.avatar_url}
                        />
                        <div>
                          {profile.username ? (
                            <Link
                              to="/perfil/$username"
                              params={{ username: profile.username.replace(/^@/, "") }}
                            >
                              <h3>
                                {getExploreProfileName(profile)}
                                {profile.is_admin ? <AdminVerifiedBadge /> : null}
                              </h3>
                            </Link>
                          ) : (
                            <h3>
                              {getExploreProfileName(profile)}
                              {profile.is_admin ? <AdminVerifiedBadge /> : null}
                            </h3>
                          )}
                          <p>{getExploreProfileUsername(profile)}</p>
                          {profile.bio ? <small>{profile.bio}</small> : null}
                        </div>
                        <Link to="/conexoes">Conectar</Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="explore-state">Nenhuma conta encontrada por enquanto.</p>
                )}
              </section>
            </div>
          </section>
        </div>

        <aside className="home-context-rail explore-right-rail" aria-label="Atalhos e descobertas">
          <div className="home-search-area">
            <label className="explore-search explore-search-compact">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar na Looma"
              />
            </label>
          </div>
          <div className="home-discovery-board">
            <section
              className="home-discovery-section home-opportunities-section"
              aria-labelledby="explore-opportunities-title"
            >
              <header className="home-section-header">
                <div>
                  <h2 id="explore-opportunities-title">Oportunidades</h2>
                  <p>Vagas, projetos e pedidos publicados pela comunidade.</p>
                </div>
                <Link to="/oportunidades">Ver todas</Link>
              </header>
              {loadingOpportunities ? (
                <div className="home-discovery-skeleton" aria-label="Carregando oportunidades">
                  <i />
                  <i />
                </div>
              ) : opportunitiesError ? (
                <section className="home-discovery-empty" role="alert">
                  <p>Não foi possível carregar oportunidades: {opportunitiesError}</p>
                </section>
              ) : opportunities.length ? (
                <div className="home-opportunity-grid">
                  {opportunities.map((opportunity) => (
                    <Link
                      className="home-opportunity-card"
                      key={opportunity.id}
                      to="/oportunidades"
                    >
                      <div className="home-opportunity-card-top">
                        <BriefcaseBusiness size={18} aria-hidden="true" />
                        {opportunity.category ? <span>{opportunity.category}</span> : null}
                      </div>
                      <h3>{opportunity.title}</h3>
                      <p>{opportunity.description}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <section className="home-discovery-empty">
                  <h3>Sem oportunidades por enquanto</h3>
                  <p>Quando a comunidade publicar algo novo, aparecerá aqui.</p>
                </section>
              )}
            </section>

            <section className="home-discovery-section" aria-labelledby="explore-suggested-title">
              <header className="home-section-header">
                <div>
                  <h2 id="explore-suggested-title">Pessoas para conhecer</h2>
                  <p>Contas que já fazem parte da Looma.</p>
                </div>
                <Link to="/conexoes">Ver todas</Link>
              </header>
              {filteredProfiles.length ? (
                <div className="home-people-grid">
                  {filteredProfiles.slice(0, 3).map((profile) => (
                    <article className="home-person-card" key={profile.id}>
                      <ProfileAvatar
                        className="avatar"
                        fullName={getExploreProfileName(profile)}
                        avatarUrl={profile.avatar_url}
                      />
                      <div>
                        <h3>{getExploreProfileName(profile)}</h3>
                        <p>{getExploreProfileUsername(profile)}</p>
                        {profile.bio ? <small>{profile.bio}</small> : null}
                      </div>
                      <Link to="/conexoes">Conectar</Link>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="home-discovery-empty">
                  <h3>Sem sugestões por enquanto</h3>
                  <p>Contas recomendadas aparecerão aqui.</p>
                </section>
              )}
            </section>
          </div>

          <section className="home-next-steps">
            <div className="home-context-heading">
              <span className="home-context-icon" aria-hidden="true">
                <BadgeCheck size={17} />
              </span>
              <div>
                <h2>Construa sua presença.</h2>
              </div>
            </div>
            <p>Pequenas ações deixam seu perfil pronto para as oportunidades certas.</p>
            <div className="home-next-step-actions">
              <Link to="/perfil">
                <Pencil size={16} aria-hidden="true" /> Completar portfólio
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/oportunidades">
                <BriefcaseBusiness size={16} aria-hidden="true" /> Explorar oportunidades
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="home-trending-card" aria-labelledby="explore-areas-title">
            <header>
              <div>
                <h2 id="explore-areas-title">Áreas para explorar</h2>
              </div>
              <Compass size={18} aria-hidden="true" />
            </header>
            <div className="home-trending-list">
              {EXPLORE_AREAS.map((area) => (
                <Link key={area} to="/oportunidades">
                  {area}
                </Link>
              ))}
            </div>
          </section>

          <section className="home-feed-companion">
            <h2>Boas conversas viram oportunidades.</h2>
            <p>Conheça profissionais, acompanhe ideias e dê o próximo passo no seu ritmo.</p>
            <Link to="/conexoes" className="home-companion-link">
              <UsersRound size={16} aria-hidden="true" /> Conhecer pessoas
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
