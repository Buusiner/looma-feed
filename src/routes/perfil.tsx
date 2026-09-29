import { useEffect, useState } from "react";
import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  ExternalLink,
  Gauge,
  MessageSquareText,
  Pencil,
  Tag,
} from "lucide-react";
import { AuthButton } from "@/components/looma/AuthButton";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { WorkspaceEmpty } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { getProfileName, getProfileUsername, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/perfil")({ component: PortfolioPage });

type ProfileLink = { id: string; type: string; label: string | null; url: string };
type SkillTag = { id: string; name: string };
type UserSkill = {
  id: string;
  skill_tag_id: string | null;
  custom_label: string | null;
};
type PortfolioSkill = { id: string; name: string };

function PortfolioPage() {
  const { user, profile, isLoading } = useCurrentProfile();
  const pathname = useLocation({ select: (location: { pathname: string }) => location.pathname });
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [skills, setSkills] = useState<PortfolioSkill[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId || pathname !== "/perfil") {
      setLinks([]);
      setSkills([]);
      setDetailsError(null);
      setIsLoadingDetails(false);
      return;
    }

    let isCurrent = true;
    const profileId = userId;
    setIsLoadingDetails(true);
    setDetailsError(null);

    async function loadPortfolioDetails() {
      try {
        const supabase = getSupabaseBrowserClient();
        const [linksResult, userSkillsResult, skillTagsResult] = await Promise.all([
          supabase
            .from("profile_links")
            .select("id, type, label, url")
            .eq("profile_id", profileId)
            .order("created_at"),
          supabase
            .from("user_skills")
            .select("id, skill_tag_id, custom_label")
            .eq("profile_id", profileId),
          supabase.from("skill_tags").select("id, name"),
        ]);

        if (linksResult.error) throw linksResult.error;
        if (userSkillsResult.error) throw userSkillsResult.error;
        if (skillTagsResult.error) throw skillTagsResult.error;
        if (!isCurrent) return;

        const tagsById = new Map(
          ((skillTagsResult.data ?? []) as SkillTag[]).map((skill) => [skill.id, skill.name]),
        );
        const portfolioSkills = ((userSkillsResult.data ?? []) as UserSkill[]).flatMap((skill) => {
          const name = skill.skill_tag_id
            ? tagsById.get(skill.skill_tag_id)
            : skill.custom_label?.trim();
          return name ? [{ id: skill.id, name }] : [];
        });

        setLinks((linksResult.data ?? []) as ProfileLink[]);
        setSkills(portfolioSkills);
      } catch (caught) {
        console.error("[Looma] Não foi possível carregar os detalhes do portfólio.", caught);
        if (isCurrent) {
          setLinks([]);
          setSkills([]);
          setDetailsError("Não foi possível carregar suas habilidades e links agora.");
        }
      } finally {
        if (isCurrent) setIsLoadingDetails(false);
      }
    }

    void loadPortfolioDetails();
    return () => {
      isCurrent = false;
    };
  }, [pathname, userId]);

  // `/perfil` is the public portfolio; child routes own their full page.
  if (pathname !== "/perfil") return <Outlet />;

  if (isLoading) {
    return (
      <WorkspaceLayout title="Portfólio" description="Seu espaço profissional na comunidade Looma.">
        <p className="workspace-helper">Carregando portfólio…</p>
      </WorkspaceLayout>
    );
  }

  if (!user) {
    return (
      <WorkspaceLayout title="Portfólio" description="Seu espaço profissional na comunidade Looma.">
        <WorkspaceEmpty
          icon={BriefcaseBusiness}
          title="Entre para montar seu portfólio"
          description="Faça login para apresentar seu trabalho, bio e informações de perfil."
          action={<AuthButton />}
        />
      </WorkspaceLayout>
    );
  }

  const name = getProfileName(profile, user);
  const username = getProfileUsername(profile, user);
  return (
    <WorkspaceLayout
      title="Portfólio"
      description="Apresente sua identidade e o seu trabalho na Looma."
      action={
        <Link className="workspace-primary-action" to="/perfil/editar">
          <Pencil size={16} /> Editar portfólio
        </Link>
      }
    >
      <section className="workspace-card workspace-person-card">
        <ProfileAvatar
          className="workspace-avatar"
          fullName={name}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <div>
          <h2>{name}</h2>
          <p>{username}</p>
          <p>{profile?.bio?.trim() || "Adicione uma bio para apresentar o seu trabalho."}</p>
        </div>
      </section>
      <section
        className="workspace-section portfolio-section"
        aria-labelledby="portfolio-skills-title"
      >
        <header>
          <div>
            <p className="portfolio-section-label">Perfil profissional</p>
            <h2 id="portfolio-skills-title">Tags e habilidades</h2>
            <p>Áreas que ajudam outras pessoas a encontrar seu trabalho.</p>
          </div>
          <Tag size={19} aria-hidden="true" />
        </header>
        {isLoadingDetails ? (
          <p className="portfolio-section-status">Carregando habilidades…</p>
        ) : detailsError ? (
          <p className="portfolio-section-status portfolio-section-status-error" role="alert">
            {detailsError}
          </p>
        ) : skills.length ? (
          <div className="portfolio-skill-list" aria-label="Habilidades selecionadas">
            {skills.map((skill) => (
              <span key={skill.id}>{skill.name}</span>
            ))}
          </div>
        ) : (
          <div className="portfolio-empty-state">
            <p>Nenhuma tag adicionada ainda</p>
            <Link className="portfolio-section-action" to="/perfil/editar">
              Adicionar tags
            </Link>
          </div>
        )}
      </section>
      <section
        className="workspace-section portfolio-section"
        aria-labelledby="portfolio-reviews-title"
      >
        <header>
          <div>
            <p className="portfolio-section-label">Reputação</p>
            <h2 id="portfolio-reviews-title">Avaliações</h2>
            <p>Feedback de pessoas que já trabalharam com você aparecerá aqui.</p>
          </div>
          <MessageSquareText size={19} aria-hidden="true" />
        </header>
        <div className="portfolio-empty-state portfolio-empty-state-muted">
          <p>Ainda sem avaliações</p>
        </div>
      </section>
      <section
        className="workspace-section portfolio-section"
        aria-labelledby="portfolio-performance-title"
      >
        <header>
          <div>
            <p className="portfolio-section-label">Evolução</p>
            <h2 id="portfolio-performance-title">Desempenho profissional</h2>
            <p>Um indicador construído a partir da sua atividade na Looma.</p>
          </div>
          <Gauge size={19} aria-hidden="true" />
        </header>
        <div className="portfolio-performance-empty">
          <span className="portfolio-performance-ring" aria-hidden="true" />
          <div>
            <h3>Desempenho ainda não calculado</h3>
            <p>Esse indicador será exibido quando houver dados suficientes.</p>
          </div>
        </div>
      </section>
      {links.length ? (
        <section
          className="workspace-section workspace-portfolio-links portfolio-section"
          aria-labelledby="portfolio-links-title"
        >
          <h2 id="portfolio-links-title">Onde me encontrar</h2>
          <div>
            {links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                <span>{link.type === "outro" ? link.label : link.type}</span>
                <ExternalLink size={15} />
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </WorkspaceLayout>
  );
}
