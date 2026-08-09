import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";

type StateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onRetry?: () => void;
};

export function WorkspaceSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="workspace-skeleton" aria-label="Carregando conteúdo">
      {Array.from({ length: cards }, (_, index) => <span key={index} />)}
    </div>
  );
}

export function WorkspaceEmpty({ icon: Icon, title, description, action }: Omit<StateProps, "onRetry"> & { action?: ReactNode }) {
  return (
    <section className="workspace-state">
      <Icon size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function WorkspaceError({ icon: Icon, title, description, onRetry }: StateProps) {
  return (
    <section className="workspace-state workspace-state-error" role="alert">
      <Icon size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry ? <button type="button" onClick={onRetry}><RefreshCw size={15} /> Tentar novamente</button> : null}
    </section>
  );
}
