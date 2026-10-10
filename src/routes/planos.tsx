import { Link, createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { AuthButton } from "@/components/looma/AuthButton";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { WorkspaceEmpty, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { useCurrentProfile } from "@/lib/profile";

export const Route = createFileRoute("/planos")({ component: ResourcesPage });

function ResourcesPage() {
  const { user, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <WorkspaceLayout title="Recursos" description="Conheça o que você pode fazer na Looma.">
        <WorkspaceSkeleton cards={3} />
      </WorkspaceLayout>
    );
  }

  if (!user) {
    return (
      <WorkspaceLayout title="Recursos" description="Conheça o que você pode fazer na Looma.">
        <WorkspaceEmpty
          icon={BadgeCheck}
          title="Entre para acessar os recursos"
          description="Faça login para conhecer e usar os recursos da Looma."
          action={<AuthButton />}
        />
      </WorkspaceLayout>
    );
  }

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
