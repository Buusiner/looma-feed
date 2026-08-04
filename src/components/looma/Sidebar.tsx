import {
  Home,
  Search,
  Bell,
  MessageCircle,
  Users,
  Briefcase,
  Globe,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import logo from "@/assets/looma-logo.png.asset.json";

const NAV = [
  { icon: Home, label: "Início", active: true },
  { icon: Search, label: "Explorar" },
  { icon: Bell, label: "Notificações" },
  { icon: MessageCircle, label: "Mensagens" },
  { icon: Users, label: "Conexões" },
  { icon: Briefcase, label: "Marketplace" },
  { icon: Globe, label: "Comunidades" },
  { icon: Settings, label: "Configurações" },
];

export function LoomaSidebar() {
  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-60 flex-col bg-surface border-r border-line lg:flex">
      <div className="flex items-center gap-2 border-b border-line px-5 py-6">
        <img src={logo.url} alt="Logo da looma" className="h-8 w-auto" />
        <span className="text-[22px] font-bold text-primary">looma</span>
      </div>

      <nav className="flex flex-1 flex-col py-2">
        {NAV.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            type="button"
            className={
              "mx-3 my-0.5 flex items-center gap-3 rounded-[10px] px-4 py-3 text-[15px] font-medium transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground")
            }
          >
            <Icon size={20} />
            {label}
          </button>
        ))}

        <button
          type="button"
          className="m-3 rounded-full bg-primary py-3.5 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Publicar
        </button>
      </nav>

      <div className="flex items-center gap-3 border-t border-line px-5 py-4">
        <div className="h-9 w-9 shrink-0 rounded-full bg-avatar" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">Usuário</p>
          <p className="truncate text-[13px] text-muted-foreground">@usuario</p>
        </div>
        <MoreHorizontal size={18} className="text-muted-foreground" />
      </div>
    </aside>
  );
}
