import { FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { WorkspaceEmpty, WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Post = { id: string; content: string; status: "published" | "draft"; likes_count: number; comments_count: number; created_at: string };
type Tab = "all" | "published" | "draft";

export const Route = createFileRoute("/publicacoes")({ component: PostsPage });

function PostsPage() {
  const { user } = useCurrentProfile();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [content, setContent] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user) { setPosts([]); setLoading(false); return; }
    setLoading(true); setError(null);
    const { data, error: queryError } = await getSupabaseBrowserClient().from("posts").select("id, content, status, likes_count, comments_count, created_at").eq("author_id", user.id).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message); else setPosts((data ?? []) as Post[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [user?.id]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !content.trim()) return;
    setSaving(true); setError(null);
    const { error: insertError } = await getSupabaseBrowserClient().from("posts").insert({ author_id: user.id, content: content.trim(), status: "published" });
    if (insertError) setError(insertError.message); else { setContent(""); setComposerOpen(false); await load(); }
    setSaving(false);
  }

  async function editPost(post: Post) {
    const nextContent = window.prompt("Edite sua publicação", post.content);
    if (nextContent === null || !nextContent.trim()) return;
    const { error: updateError } = await getSupabaseBrowserClient().from("posts").update({ content: nextContent.trim(), updated_at: new Date().toISOString() }).eq("id", post.id);
    if (updateError) setError(updateError.message); else await load();
  }
  async function deletePost(id: string) {
    if (!window.confirm("Excluir esta publicação? Esta ação não pode ser desfeita.")) return;
    const { error: deleteError } = await getSupabaseBrowserClient().from("posts").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else await load();
  }

  const visiblePosts = posts.filter((post) => tab === "all" || post.status === tab);
  const emptyDescription = !user ? "Entre com sua conta para gerenciar suas publicações." : tab === "draft" ? "Você não tem rascunhos salvos." : "Você ainda não publicou nada.";

  return <WorkspaceLayout title="Publicações" description="Gerencie as publicações criadas por você." action={<button className="workspace-primary-action" onClick={() => setComposerOpen((open) => !open)}><Plus size={17} /> Nova publicação</button>}>
    {composerOpen ? <form className="workspace-composer" onSubmit={createPost}><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Compartilhe uma ideia, oportunidade ou projeto" maxLength={300} /><div><span>{content.length}/300</span><button disabled={saving || !content.trim()}>{saving ? "Publicando…" : "Publicar"}</button></div></form> : null}
    <div className="workspace-tabs">{(["all", "published", "draft"] as Tab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value === "all" ? "Todas" : value === "published" ? "Publicadas" : "Rascunhos"}</button>)}</div>
    {loading ? <WorkspaceSkeleton cards={3} /> : error ? <WorkspaceError icon={FileText} title="Não foi possível carregar suas publicações" description={error} onRetry={() => void load()} /> : visiblePosts.length === 0 ? <WorkspaceEmpty icon={FileText} title={emptyDescription} description={user ? "Use “Nova publicação” para compartilhar algo com a comunidade." : ""} /> : <section className="workspace-card-list">{visiblePosts.map((post) => <article className="workspace-card" key={post.id}><div className="workspace-card-heading"><div><span className="workspace-status">{post.status === "draft" ? "Rascunho" : "Publicada"}</span><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(post.created_at))}</time></div><div className="workspace-inline-actions"><button onClick={() => void editPost(post)} aria-label="Editar publicação"><MoreHorizontal size={17} /></button><button onClick={() => void deletePost(post.id)} aria-label="Excluir publicação"><Trash2 size={17} /></button></div></div><p>{post.content}</p><small>{post.likes_count} curtidas · {post.comments_count} comentários</small></article>)}</section>}
  </WorkspaceLayout>;
}
