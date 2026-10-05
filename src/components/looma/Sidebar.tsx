import {
  BarChart3,
  BadgeCheck,
  Bell,
  CircleHelp,
  FileText,
  Home,
  LogOut,
  Moon,
  Pencil,
  Send,
  Settings,
  ShieldCheck,
  Search,
  Sun,
  UserRound,
  BriefcaseBusiness,
  Menu,
} from "lucide-react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useState } from "react";
import { AuthButton } from "./AuthButton";
import { AdminVerifiedBadge } from "./AdminVerifiedBadge";
import { ProfileAvatar } from "./ProfileAvatar";
import { getProfileName, getProfileUsername, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminAccess } from "@/lib/admin";
import { applyTheme, getStoredTheme, saveTheme } from "@/lib/theme";
import { getUnreadNotificationCount } from "@/lib/notifications";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_GROUPS = [
  {
    id: "main",
    items: [
      { icon: Home, label: "Início", path: "/" },
      { icon: Search, label: "Explorar", path: "/explorar" },
      { icon: Bell, label: "Notificações", path: "/notificacoes", showsUnreadDot: true },
      { icon: UserRound, label: "Conexões", path: "/conexoes" },
      { icon: FileText, label: "Publicações", path: "/publicacoes" },
      { icon: BriefcaseBusiness, label: "Portfólio", path: "/perfil" },
    ],
  },
  {
    id: "work",
    items: [
      { icon: BriefcaseBusiness, label: "Oportunidades", path: "/oportunidades" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: Send, label: "Propostas", path: "/propostas" },
    ],
  },
  {
    id: "account",
    items: [{ icon: BadgeCheck, label: "Recursos", path: "/planos" }],
  },
];

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
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMobileMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    setIsDarkTheme(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setHasUnreadNotifications(false);
      return;
    }

    let isCurrent = true;
    void getUnreadNotificationCount(getSupabaseBrowserClient(), userId).then(
      ({ count, errors }) => {
        if (!isCurrent) return;
        if (errors.length) {
          console.error("[Looma] Não foi possível carregar indicador de notificações.", errors);
        }
        setHasUnreadNotifications(count > 0);
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [pathname, user?.id]);

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    saveTheme(nextTheme);
    applyTheme(getStoredTheme());
    setIsDarkTheme(nextTheme === "dark");
  }

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

  const sidebarContent = (
    <>
      <Link to="/" className="sidebar-logo-link" aria-label="Voltar para o início">
        <span className="looma-logo-mark sidebar-logo-mark" role="img" aria-label="Looma" />
      </Link>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-nav-group" key={group.id}>
            {group.items.map(({ icon: Icon, label, path, showsUnreadDot }) => {
              const isActive =
                pathname === path || (path === "/perfil" && pathname.startsWith("/perfil"));
              return (
                <Link
                  key={label}
                  to={path}
                  className={isActive ? "active" : ""}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="sidebar-nav-icon">
                    <Icon size={16} aria-hidden="true" />
                    {showsUnreadDot && hasUnreadNotifications ? (
                      <span className="sidebar-notification-dot" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <AuthButton variant="sidebar" />

      <div className="sidebar-profile-wrap">
        <div className="sidebar-footer-row">
          <div className="sidebar-profile">
            <button
              type="button"
              className="sidebar-profile-main"
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
                  <span className="sidebar-profile-name-text">{displayName}</span>
                  {isAdmin ? <AdminVerifiedBadge /> : null}
                </strong>
                {username ? <small>{username}</small> : null}
              </span>
            </button>
            <Link
              to="/configuracoes"
              className="sidebar-profile-settings"
              aria-label="Abrir configurações"
              onClick={() => setIsProfileMenuOpen(false)}
            >
              <Settings size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-theme-item"
          data-ui-sound="none"
          aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
          onClick={toggleTheme}
        >
          <Sun className="theme-icon-light" size={17} aria-hidden="true" />
          <Moon className="theme-icon-dark" size={17} aria-hidden="true" />
          <span>{isDarkTheme ? "Modo claro" : "Modo escuro"}</span>
        </button>
        <Link to="/comunidade" className="sidebar-help-link">
          <CircleHelp size={13} aria-hidden="true" />
          <span>Ajuda</span>
        </Link>

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
    </>
  );

  return (
    <>
      <aside className="looma-sidebar desktop-sidebar fixed left-0 top-0 z-30 hidden h-screen w-60 lg:flex">
        {sidebarContent}
      </aside>
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <header className="mobile-app-header">
          <Link to="/" className="mobile-brand" aria-label="Voltar para o início">
            <span className="looma-logo-mark" aria-hidden="true" />
            <span>Looma</span>
          </Link>
          <Link to="/perfil" className="mobile-profile-link" aria-label="Abrir portfólio">
            <ProfileAvatar
              className="profile-avatar"
              fullName={displayName}
              avatarUrl={profile?.avatar_url}
            />
          </Link>
        </header>
        <nav className="mobile-app-nav" aria-label="Navegação principal móvel">
          {NAV_GROUPS[0]?.items.slice(0, 4).map(({ icon: Icon, label, path, showsUnreadDot }) => (
            <Link key={path} to={path} aria-current={pathname === path ? "page" : undefined}>
              <span className="mobile-nav-icon">
                <Icon size={21} aria-hidden="true" />
                {showsUnreadDot && hasUnreadNotifications ? (
                  <span className="sidebar-notification-dot" />
                ) : null}
              </span>
              <span>{label}</span>
            </Link>
          ))}
          <SheetTrigger asChild>
            <button type="button" aria-label="Abrir menu de navegação">
              <Menu size={21} aria-hidden="true" />
              <span>Menu</span>
            </button>
          </SheetTrigger>
        </nav>
        <SheetContent side="left" className="mobile-navigation-sheet">
          <SheetTitle className="sr-only">Navegação Looma</SheetTitle>
          <SheetDescription className="sr-only">
            Explore a Looma e gerencie a sua conta.
          </SheetDescription>
          <aside
            className="looma-sidebar mobile-sidebar"
            onClick={(event) => {
              if (
                (event.target as HTMLElement).closest("a[href]") &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              )
                setIsMobileMenuOpen(false);
            }}
          >
            {sidebarContent}
          </aside>
        </SheetContent>
      </Sheet>
    </>
  );
}
