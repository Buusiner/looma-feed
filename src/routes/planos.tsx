import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { LoomaSidebar } from "@/components/looma/Sidebar";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export const Route = createFileRoute("/planos")({ component: PlansPage });

const BASIC_FEATURES = [
  "Perfil e portfólio profissional",
  "Conexões e propostas",
  "Publicações e oportunidades",
];

const FREE_FEATURES = [
  "Crie seu perfil profissional",
  "Explore a comunidade Looma",
  "Comece a construir conexões",
];

const PRO_FEATURES = [
  "Tudo do Basic",
  "Mais destaque nas buscas",
  "Recursos avançados de visibilidade",
  "Acesso prioritário às novidades",
];

function PlansPage() {
  const { user } = useCurrentProfile();
  const [hasRegisteredInterest, setHasRegisteredInterest] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setHasRegisteredInterest(false);
      return;
    }

    let isCurrent = true;

    async function loadRegisteredInterest() {
      const { data, error } = await getSupabaseBrowserClient()
        .from("plan_interest")
        .select("id")
        .eq("profile_id", userId)
        .eq("plan", "pro")
        .maybeSingle();

      if (!isCurrent) return;

      if (error) {
        console.error("[Looma] Falha ao consultar interesse no plano Pro.", error);
        setFeedback("Não foi possível verificar seu interesse no Pro agora.");
        return;
      }

      setHasRegisteredInterest(Boolean(data));
    }

    void loadRegisteredInterest().catch((error: unknown) => {
      if (!isCurrent) return;
      console.error("[Looma] Erro inesperado ao consultar interesse no plano Pro.", error);
      setFeedback("Não foi possível verificar seu interesse no Pro agora.");
    });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  async function registerInterest() {
    if (!user) {
      setFeedback("Entre com sua conta para registrar interesse no Pro.");
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    const { error } = await getSupabaseBrowserClient()
      .from("plan_interest")
      .upsert(
        { profile_id: user.id, plan: "pro", updated_at: new Date().toISOString() },
        { onConflict: "profile_id,plan" },
      );

    if (error) {
      console.error("[Looma] Falha ao registrar interesse no plano Pro.", error);
      setFeedback("Não foi possível registrar seu interesse. Tente novamente.");
    } else {
      setHasRegisteredInterest(true);
      setFeedback("Interesse registrado. Avisaremos você quando o Pro estiver disponível.");
    }
    setIsSaving(false);
  }

  return (
    <main className="workspace-page plans-page">
      <LoomaSidebar />
      <section className="workspace-content plans-content">
        <header className="plans-hero">
          <div className="plans-brand" aria-label="Looma">
            <span className="looma-logo-mark" role="img" aria-label="Logo da Looma" />
            <strong>looma</strong>
          </div>
          <span className="plans-eyebrow">
            <Sparkles size={15} aria-hidden="true" /> Planos
          </span>
          <h1>Escolha como quer crescer na Looma.</h1>
          <p>
            Comece sem custo. O Pro está sendo preparado para dar mais visibilidade ao seu trabalho.
          </p>
        </header>

        <section className="plans-grid" aria-label="Planos Looma">
          <article className="plan-card plan-card-free">
            <div>
              <span className="plan-label">Para experimentar</span>
              <h2>Free</h2>
              <p>O ponto de partida para conhecer a Looma no seu ritmo.</p>
            </div>
            <ul>
              {FREE_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check size={17} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <button type="button" className="plan-free-button" disabled>
              Plano gratuito
            </button>
          </article>

          <article className="plan-card">
            <div>
              <span className="plan-label">Para começar</span>
              <h2>Basic</h2>
              <p>O essencial para construir sua presença e criar conexões.</p>
            </div>
            <ul>
              {BASIC_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check size={17} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <button type="button" className="plan-basic-button" disabled>
              Plano atual
            </button>
          </article>

          <article className="plan-card plan-card-pro">
            <div>
              <span className="plan-label">Em breve</span>
              <h2>Pro</h2>
              <p>Mais alcance para quem quer transformar boas conexões em trabalho.</p>
            </div>
            <ul>
              {PRO_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check size={17} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="plan-pro-button"
              onClick={() => void registerInterest()}
              disabled={isSaving || hasRegisteredInterest}
            >
              {isSaving
                ? "Registrando…"
                : hasRegisteredInterest
                  ? "Interesse registrado"
                  : "Quero o Pro"}
            </button>
          </article>
        </section>
        {feedback ? (
          <p
            className={
              feedback.startsWith("Interesse") ? "plans-feedback success" : "plans-feedback"
            }
            role="status"
          >
            {feedback}
          </p>
        ) : null}
      </section>
    </main>
  );
}
