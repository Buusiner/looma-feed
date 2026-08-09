import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createFileRoute, redirect } from "@tanstack/react-router";

type ProtectedUser = {
  id: string;
  email: string | null;
  name: string | null;
};

const getProtectedUser = createServerFn({ method: "GET" }).handler((): ProtectedUser => {
  const serializedUser = getRequest().headers.get("x-looma-authenticated-user");
  if (!serializedUser) throw redirect({ to: "/" });

  return JSON.parse(serializedUser) as ProtectedUser;
});

export const Route = createFileRoute("/protegida")({
  beforeLoad: () => getProtectedUser(),
  component: ProtectedPage,
});

function ProtectedPage() {
  const user = Route.useRouteContext();

  return (
    <main className="protected-page">
      <section>
        <p>Área protegida</p>
        <h1>Olá{user.name ? `, ${user.name}` : ""}.</h1>
        <span>Usuário validado no servidor: {user.email ?? user.id}</span>
        <a href="/">Voltar à Looma</a>
      </section>
    </main>
  );
}
