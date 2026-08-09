import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, FileSignature, X } from "lucide-react";
import { WorkspaceEmpty, WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Proposal = { id: string; sender_id: string; recipient_id: string; title: string; message: string; status: "pending" | "accepted" | "declined"; created_at: string };
type Tab = "sent" | "received";
export const Route = createFileRoute("/propostas")({ component: ProposalsPage });

function ProposalsPage() {
  const { user } = useCurrentProfile();
  const [tab, setTab] = useState<Tab>("sent");
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true); setError(null);
    const field = tab === "sent" ? "sender_id" : "recipient_id";
    const { data, error: queryError } = await getSupabaseBrowserClient().from("proposals").select("id, sender_id, recipient_id, title, message, status, created_at").eq(field, user.id).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message); else setItems((data ?? []) as Proposal[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [tab, user?.id]);
  async function respond(id: string, status: "accepted" | "declined") {
    const { error: updateError } = await getSupabaseBrowserClient().from("proposals").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message); else await load();
  }
  const statusLabel = { pending: "Pendente", accepted: "Aceita", declined: "Recusada" } as const;
  return <WorkspaceLayout title="Propostas" description="Acompanhe as propostas enviadas e recebidas pela sua conta.">
    <div className="workspace-tabs"><button className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}>Enviadas</button><button className={tab === "received" ? "active" : ""} onClick={() => setTab("received")}>Recebidas</button></div>
    {loading ? <WorkspaceSkeleton cards={3} /> : error ? <WorkspaceError icon={FileSignature} title="Não foi possível carregar propostas" description={error} onRetry={() => void load()} /> : items.length === 0 ? <WorkspaceEmpty icon={FileSignature} title={tab === "sent" ? "Nenhuma proposta enviada" : "Nenhuma proposta recebida"} description={user ? "Quando houver propostas, elas aparecerão aqui." : "Entre com sua conta para consultar propostas."} /> : <section className="workspace-card-list">{items.map((item) => <article className="workspace-card" key={item.id}><div className="workspace-card-heading"><div><span className={`workspace-status ${item.status}`}>{statusLabel[item.status]}</span><h2>{item.title}</h2></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.created_at))}</time></div><p>{item.message || "Sem mensagem adicional."}</p>{tab === "received" && item.status === "pending" ? <div className="workspace-card-actions"><button className="workspace-primary-action" onClick={() => void respond(item.id, "accepted")}><Check size={16} /> Aceitar</button><button onClick={() => void respond(item.id, "declined")}><X size={16} /> Recusar</button></div> : null}</article>)}</section>}
  </WorkspaceLayout>;
}
