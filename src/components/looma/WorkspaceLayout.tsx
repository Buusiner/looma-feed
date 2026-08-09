import type { ReactNode } from "react";
import { LoomaSidebar } from "./Sidebar";

type WorkspaceLayoutProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export function WorkspaceLayout({ title, description, action, children }: WorkspaceLayoutProps) {
  return (
    <main className="workspace-page">
      <LoomaSidebar />
      <section className="workspace-content">
        <header className="workspace-header">
          <div>
            <h1>{title}</h1>
            <span>{description}</span>
          </div>
          {action ? <div className="workspace-header-action">{action}</div> : null}
        </header>
        {children}
      </section>
    </main>
  );
}
