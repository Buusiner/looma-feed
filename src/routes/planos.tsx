import { Check } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { LoomaSidebar } from "@/components/looma/Sidebar";

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
  return (
    <main className="workspace-page plans-page">
      <LoomaSidebar />
      <section className="workspace-content plans-content">
        <header className="plans-hero">
          <a href="/" className="plans-back-link">
            ← Voltar
          </a>
          <h1>Planos</h1>
          <p>Escolha o nível de acesso da sua conta.</p>
        </header>

        <section className="plans-grid" aria-label="Planos Looma">
          <article className="plan-card plan-card-free">
            <div>
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

          <article className="plan-card plan-card-current">
            <div>
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
            <button type="button" className="plan-pro-button" disabled>
              Indisponível
            </button>
          </article>
        </section>
      </section>
    </main>
  );
}
