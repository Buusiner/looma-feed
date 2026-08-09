import { createFileRoute } from "@tanstack/react-router";
import { LoomaLanding } from "@/components/looma/Landing";
import { useSplashState } from "@/lib/splash-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Looma — conexões que viram oportunidades" },
      {
        name: "description",
        content:
          "A Looma conecta profissionais, criadores e empresas a oportunidades reais no mercado digital.",
      },
      { property: "og:title", content: "Looma — conexões que viram oportunidades" },
      {
        property: "og:description",
        content: "Pessoas certas, projetos reais e oportunidades que acontecem.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { shouldPlaySplash, completeSplash } = useSplashState();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <LoomaLanding showSplash={shouldPlaySplash} onSplashComplete={completeSplash} />
    </div>
  );
}
