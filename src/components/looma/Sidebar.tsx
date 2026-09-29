import {
  BarChart3,
  ChevronsUpDown,
  CircleHelp,
  FileText,
  Home,
  LogOut,
  Pencil,
  Send,
  Settings,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  UserRound,
  BriefcaseBusiness,
  Users,
} from "lucide-react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { type MouseEvent, useState } from "react";
import { AuthButton } from "./AuthButton";
import { AdminVerifiedBadge } from "./AdminVerifiedBadge";
import { ProfileAvatar } from "./ProfileAvatar";
import { getProfileName, getProfileUsername, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminAccess } from "@/lib/admin";

const NAV_GROUPS = [
  {
    id: "main",
    items: [
      { icon: Home, label: "Início", path: "/" },
      { icon: Users, label: "Conexões", path: "/conexoes" },
      { icon: FileText, label: "Publicações", path: "/publicacoes" },
      { icon: BriefcaseBusiness, label: "Portfólio", path: "/perfil" },
    ],
  },
  {
    id: "work",
    items: [
      { icon: TrendingUp, label: "Oportunidades em alta", path: "/oportunidades" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: Send, label: "Propostas", path: "/propostas" },
    ],
  },
  {
    id: "account",
    items: [
      { icon: CircleHelp, label: "Comunidade e Ajuda", path: "/comunidade" },
      { icon: Settings, label: "Configurações", path: "/configuracoes" },
      { icon: Sparkles, label: "Planos", path: "/planos" },
    ],
  },
];

// Keep the Premium card ready to be restored without removing its markup.
const SHOW_PREMIUM_UPSELL = false;
const PROFILE_ROUTE_FADE_MS = 1000;

export function LoomaSidebar() {
  const pathname = useLocation({ select: (location: { pathname: string }) => location.pathname });
  const router = useRouter();
  const { profile, user } = useCurrentProfile();
  const { isAdmin } = useAdminAccess(user);
  const displayName = user ? getProfileName(profile, user) : "Usuário";
  const username = user ? getProfileUsername(profile, user) : null;
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isLeavingForProfile, setIsLeavingForProfile] = useState(false);

  function openProfileEditor(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (isLeavingForProfile) return;
    setIsProfileMenuOpen(false);
    setIsLeavingForProfile(true);
    document.documentElement.classList.add("looma-route-leaving");
    window.setTimeout(() => router.navigate({ to: "/perfil/editar" }), PROFILE_ROUTE_FADE_MS);
  }

  async function signOut() {
    setIsSigningOut(true);
    setSignOutError(null);
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) {
      console.error("[Looma] Falha ao encerrar sessão.", error);
      setSignOutError("Não foi possível encerrar a sessão.");
    } else {
      setIsProfileMenuOpen(false);
    }
    setIsSigningOut(false);
  }

  return (
    <aside className="looma-sidebar fixed left-0 top-0 z-30 hidden h-screen w-60 lg:flex">
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-nav-group" key={group.id}>
            {group.items.map(({ icon: Icon, label, path }) => {
              const isActive =
                pathname === path || (path === "/perfil" && pathname.startsWith("/perfil"));
              return (
                <Link
                  key={label}
                  to={path}
                  className={isActive ? "active" : ""}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <section
        className={SHOW_PREMIUM_UPSELL ? "sidebar-upgrade" : "sidebar-upgrade hidden"}
        aria-label="Plano Premium"
      >
        <strong>Upgrade para o Premium!</strong>
        <p>Apareça mais nas buscas</p>
        <button type="button">Fazer upgrade</button>
      </section>

      <AuthButton variant="sidebar" />

      <div className="sidebar-profile-wrap">
        <button
          type="button"
          className="sidebar-profile"
          aria-label="Abrir menu do perfil"
          aria-expanded={isProfileMenuOpen}
          onClick={() => setIsProfileMenuOpen((open) => !open)}
        >
          {user ? (
            <ProfileAvatar
              className="profile-avatar"
              fullName={displayName}
              avatarUrl={profile?.avatar_url}
            />
          ) : (
            <span className="profile-avatar profile-avatar-guest" aria-hidden="true">
              <UserRound size={18} />
            </span>
          )}
          <span>
            <strong>
              {displayName}
              {isAdmin ? <AdminVerifiedBadge /> : null}
            </strong>
            {username ? <small>{username}</small> : null}
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>

        {isProfileMenuOpen ? (
          <div className="sidebar-profile-menu" role="menu">
            {user ? (
              <>
                <Link to="/perfil/editar" role="menuitem" onClick={openProfileEditor}>
                  <Pencil size={15} aria-hidden="true" /> Editar perfil
                </Link>
                {isAdmin ? (
                  <Link to="/admin" role="menuitem" onClick={() => setIsProfileMenuOpen(false)}>
                    <ShieldCheck size={15} aria-hidden="true" /> Conteúdo administrativo
                  </Link>
                ) : null}
                <button type="button" role="menuitem" onClick={signOut} disabled={isSigningOut}>
                  <LogOut size={15} aria-hidden="true" /> {isSigningOut ? "Saindo…" : "Sair"}
                </button>
              </>
            ) : (
              <p className="sidebar-profile-menu-note">Entre para acessar seu perfil.</p>
            )}
            {signOutError ? <small role="alert">{signOutError}</small> : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
