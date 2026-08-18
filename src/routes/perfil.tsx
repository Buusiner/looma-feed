import { useEffect, useState } from "react";
import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { BriefcaseBusiness, ExternalLink, Pencil } from "lucide-react";
import { ProfileAvatar } from "@/components/looma/ProfileAvatar";
import { WorkspaceEmpty } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { getProfileName, getProfileUsername, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/perfil")({ component: PortfolioPage });

type ProfileLink = { id: string; type: string; label: string | null; url: string };

function PortfolioPage() {
  const { user, profile, isLoading } = useCurrentProfile();
  const pathname = useLocation({ select: (location: { pathname: string }) => location.pathname });
  const [links, setLinks] = useState<ProfileLink[]>([]);

  useEffect(() => {
    if (!user || pathname !== "/perfil") return;
    let isCurrent = true;
    const profileId = user.id;

    async function loadLinks() {
      const { data, error } = await getSupabaseBrowserClient()
        .from("profile_links")
        .select("id, type, label, url")
        .eq("profile_id", profileId)
        .order("created_at");
      if (error) {
        console.error("[Looma] Não foi possível carregar os links do portfólio.", error);
        return;
      }
      if (isCurrent) setLinks((data ?? []) as ProfileLink[]);
    }

    void loadLinks();
    return () => { isCurrent = false; };
  }, [pathname, user?.id]);

  // `/perfil` is the public portfolio; child routes own their full page.
  if (pathname !== "/perfil") return <Outlet />;

  if (isLoading) {
    return <WorkspaceLayout title="Portfólio" description="Seu espaço profissional na comunidade Looma."><p className="workspace-helper">Carregando portfólio…</p></WorkspaceLayout>;
  }

  if (!user) {
    return <WorkspaceLayout title="Portfólio" description="Seu espaço profissional na comunidade Looma."><WorkspaceEmpty icon={BriefcaseBusiness} title="Entre para montar seu portfólio" description="Faça login para apresentar seu trabalho, bio e informações de perfil." /></WorkspaceLayout>;
  }

  const name = getProfileName(profile, user);
  const username = getProfileUsername(profile, user);
  return (
    <WorkspaceLayout
      title="Portfólio"
      description="Apresente sua identidade e o seu trabalho na Looma."
      action={<Link className="workspace-primary-action" to="/perfil/editar"><Pencil size={16} /> Editar portfólio</Link>}
    >
      <section className="workspace-card workspace-person-card">
        <ProfileAvatar className="workspace-avatar" fullName={name} avatarUrl={profile?.avatar_url ?? null} />
        <div>
          <h2>{name}</h2>
          <p>{username}</p>
          <p>{profile?.bio?.trim() || "Adicione uma bio para apresentar o seu trabalho."}</p>
        </div>
      </section>
      {links.length ? <section className="workspace-section workspace-portfolio-links" aria-labelledby="portfolio-links-title"><h2 id="portfolio-links-title">Onde me encontrar</h2><div>{links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span>{link.type === "outro" ? link.label : link.type}</span><ExternalLink size={15} /></a>)}</div></section> : null}
    </WorkspaceLayout>
  );
}
