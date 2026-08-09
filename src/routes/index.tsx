import { createFileRoute } from "@tanstack/react-router";
import { Home, Search, Bell, MessageCircle, Briefcase } from "lucide-react";
import { LoomaSidebar } from "@/components/looma/Sidebar";
import { LoomaFeed } from "@/components/looma/Feed";
import { LoomaAside } from "@/components/looma/RightPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "looma — feed de criadores e freelancers" },
      {
        name: "description",
        content:
          "Acompanhe publicações, conexões e oportunidades entre criadores e freelancers no feed da looma.",
      },
      { property: "og:title", content: "looma — feed de criadores e freelancers" },
      {
        property: "og:description",
        content: "O feed da looma: publicações, conexões e oportunidades para criadores.",
      },
    ],
  }),
  component: Index,
});

const MOBILE_NAV = [Home, Search, Bell, MessageCircle, Briefcase];

function Index() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <LoomaSidebar />
      <div className="flex justify-center lg:pl-60">
        <div className="w-full max-w-[600px] pb-16 lg:pb-0">
          <LoomaFeed />
        </div>
        <LoomaAside />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t border-line bg-surface py-3 lg:hidden">
        {MOBILE_NAV.map((Icon, i) => (
          <button key={i} type="button" className="p-1">
            <Icon size={22} className={i === 0 ? "text-primary" : "text-muted-foreground"} />
          </button>
        ))}
      </nav>
    </div>
  );
}
