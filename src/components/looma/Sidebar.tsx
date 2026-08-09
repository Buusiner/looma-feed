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
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { type MouseEvent, useState } from "react";
import { AuthButton } from "./AuthButton";
import { ProfileAvatar } from "./ProfileAvatar";
import { getProfileName, getProfileUsername, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const NAV = [
  { icon: Home, label: "Início", path: "/" },
  { icon: TrendingUp, label: "Oportunidades em alta", path: "/oportunidades" },
  { icon: FileText, label: "Publicações", path: "/publicacoes" },
  { icon: Users, label: "Conexões", path: "/conexoes" },
  { icon: Send, label: "Propostas", path: "/propostas" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: CircleHelp, label: "Comunidade e Ajuda", path: "/comunidade" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: UserRound, label: "Perfil público", path: "/perfil" },
];

// Keep the Premium card ready to be restored without removing its markup.
const SHOW_PREMIUM_UPSELL = false;
const PROFILE_ROUTE_FADE_MS = 1000;

export function LoomaSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const router = useRouter();
  const { profile, user } = useCurrentProfile();
  const displayName = user ? getProfileName(profile, user) : "Usuário";
  const username = user ? getProfileUsername(profile, user) : null;
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isLeavingForProfile, setIsLeavingForProfile] = useState(false);

  function openProfileEditor(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
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
      <header className="sidebar-brand">
        <span className="looma-logo-mark sidebar-logo" role="img" aria-label="Logo da Looma" />
        <span>looma</span>
      </header>

      <nav className="sidebar-nav" aria-label="Navegação principal">
        {NAV.map(({ icon: Icon, label, path }) => {
          const isActive = pathname === path;
          if (path === "/perfil") {
            return (
              <button key={label} type="button" className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          }
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
            <strong>{displayName}</strong>
            {username ? <small>{username}</small> : null}
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>

        {isProfileMenuOpen ? (
          <div className="sidebar-profile-menu" role="menu">
            <Link to="/perfil/editar" role="menuitem" onClick={openProfileEditor}>
              <Pencil size={15} aria-hidden="true" /> Editar perfil
            </Link>
            {user ? (
              <button type="button" role="menuitem" onClick={signOut} disabled={isSigningOut}>
                <LogOut size={15} aria-hidden="true" /> {isSigningOut ? "Saindo…" : "Sair"}
              </button>
            ) : null}
            {signOutError ? <small role="alert">{signOutError}</small> : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
