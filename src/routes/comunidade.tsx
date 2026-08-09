import { FormEvent, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, CircleHelp, Send } from "lucide-react";
import { WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { getProfileName, useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const FAQ = [
  { question: "Como encontro oportunidades?", answer: "Use Oportunidades em alta para buscar publicações disponíveis e filtre os resultados pelos dados informados em cada oportunidade." },
  { question: "Como funcionam as conexões?", answer: "Conexões começam como solicitações. Quando aceitas, passam a aparecer na lista de conexões de ambas as contas." },
  { question: "Onde acompanho minhas propostas?", answer: "A página Propostas separa os envios das propostas recebidas e mostra o status atual de cada uma." },
  { question: "Como atualizo meu perfil?", answer: "Abra o card de perfil na sidebar e escolha Editar perfil para atualizar nome, username, bio e foto." },
];
export const Route = createFileRoute("/comunidade")({ component: CommunityPage });

function CommunityPage() {
  const { user, profile, isLoading } = useCurrentProfile();
  const [search, setSearch] = useState("");
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visibleFaq = useMemo(() => FAQ.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(search.toLowerCase())), [search]);
  async function sendTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user || !subject.trim() || !message.trim()) return;
    setSending(true); setError(null); setNotice(null);
    const { error: insertError } = await getSupabaseBrowserClient().from("support_tickets").insert({ user_id: user.id, name: getProfileName(profile, user), subject: subject.trim(), message: message.trim() });
    if (insertError) setError(insertError.message); else { setSubject(""); setMessage(""); setNotice("Sua mensagem foi enviada para o suporte."); }
    setSending(false);
  }
  return <WorkspaceLayout title="Comunidade e Ajuda" description="Encontre orientações e entre em contato com o suporte da Looma.">
    {isLoading ? <WorkspaceSkeleton cards={2} /> : <><section className="workspace-section"><label className="workspace-search"><CircleHelp size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nas perguntas frequentes" /></label><div className="workspace-accordion">{visibleFaq.map((item, index) => <article key={item.question}><button onClick={() => setOpenQuestion(openQuestion === index ? null : index)} aria-expanded={openQuestion === index}>{item.question}<ChevronDown size={17} /></button>{openQuestion === index ? <p>{item.answer}</p> : null}</article>)}</div>{visibleFaq.length === 0 ? <p className="workspace-inline-empty">Nenhuma pergunta corresponde à sua busca.</p> : null}</section>
    <section className="workspace-section"><header><h2>Fale com o suporte</h2><p>Envie uma mensagem e ela ficará registrada na sua conta.</p></header>{error ? <WorkspaceError icon={CircleHelp} title="Não foi possível enviar a mensagem" description={error} onRetry={() => setError(null)} /> : null}{notice ? <p className="workspace-notice">{notice}</p> : null}<form className="workspace-form" onSubmit={sendTicket}><label><span>Nome</span><input value={getProfileName(profile, user)} readOnly /></label><label><span>Assunto</span><input value={subject} onChange={(event) => setSubject(event.target.value)} required /></label><label><span>Mensagem</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={1000} /></label><button className="workspace-primary-action" disabled={!user || sending}><Send size={16} /> {sending ? "Enviando…" : "Enviar mensagem"}</button></form></section>
    <a className="workspace-guidelines" href="#diretrizes">Ler diretrizes da comunidade</a></>}
  </WorkspaceLayout>;
}
