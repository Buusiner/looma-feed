import { Link, createFileRoute } from "@tanstack/react-router";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";

export const Route = createFileRoute("/planos")({ component: ResourcesPage });

function ResourcesPage() {
  return (
    <WorkspaceLayout title="Recursos" description="Conheça o que você pode fazer na Looma.">
      <section className="workspace-section">
        <h2>Seu perfil e portfólio</h2>
        <p>Apresente seu trabalho, adicione habilidades e compartilhe seus links.</p>
        <Link className="workspace-primary-action" to="/perfil">
          Abrir portfólio
        </Link>
      </section>
      <section className="workspace-section">
        <h2>Conexões e propostas</h2>
        <p>Conheça profissionais e envie propostas de trabalho.</p>
        <Link className="workspace-primary-action" to="/conexoes">
          Ver conexões
        </Link>
      </section>
      <section className="workspace-section">
        <h2>Publicações e oportunidades</h2>
        <p>Compartilhe suas ideias e explore trabalhos publicados pela comunidade.</p>
        <Link className="workspace-primary-action" to="/oportunidades">
          Ver oportunidades
        </Link>
      </section>
    </WorkspaceLayout>
  );
}
