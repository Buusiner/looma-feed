import { audioManager } from "@/lib/audio-manager";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "@/components/looma/MediaPicker";
import { PostMedia } from "@/components/looma/PostMedia";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceSkeleton,
} from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import {
  MEDIA_COLUMNS,
  isMissingPostMediaColumns,
  removePostMedia,
  uploadPostMedia,
  type PostMediaData,
  type PreparedMedia,
  withEmptyMediaData,
} from "@/lib/media";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Post = PostMediaData & {
  id: string;
  content: string;
  kind: "post" | "work";
  likes_count: number;
  comments_count: number;
  created_at: string;
};

export const Route = createFileRoute("/publicacoes")({ component: PostsPage });

function PostsPage() {
  const { user } = useCurrentProfile();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaPickerKey, setMediaPickerKey] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [postPendingDeletion, setPostPendingDeletion] = useState<Post | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    let { data, error: queryError } = await supabase
      .from("posts")
      .select(`id, content, kind, likes_count, comments_count, created_at, ${MEDIA_COLUMNS}`)
      .eq("author_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (isMissingPostMediaColumns(queryError)) {
      const fallback = await supabase
        .from("posts")
        .select("id, content, kind, likes_count, comments_count, created_at")
        .eq("author_id", userId)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      data = fallback.data?.map(withEmptyMediaData) ?? null;
      queryError = fallback.error;
    }
    if (queryError) setError(queryError.message);
    else setPosts((data ?? []) as Post[]);
    setLoading(false);
  }, [user?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || (!content.trim() && !media) || mediaBusy) return;
    setSaving(true);
    setActionError(null);
    let uploadedMediaPath: string | null = null;
    try {
      const mediaData = await uploadPostMedia(user.id, media);
      uploadedMediaPath = mediaData.media_path;
      const { error: insertError } = await getSupabaseBrowserClient()
        .from("posts")
        .insert({
          author_id: user.id,
          content: content.trim(),
          status: "published",
          ...mediaData,
        });
      if (insertError) {
        await removePostMedia(uploadedMediaPath);
        audioManager.play("error");
        setActionError(insertError.message);
        return;
      }
      setContent("");
      audioManager.play("success");
      setMedia(null);
      setMediaPickerKey((current) => current + 1);
      setComposerOpen(false);
      await load();
    } catch (caught) {
      await removePostMedia(uploadedMediaPath);
      audioManager.play("error");
      setActionError(caught instanceof Error ? caught.message : "Não foi possível publicar.");
    } finally {
      setSaving(false);
    }
  }

  function openPostEditor(post: Post) {
    setEditingPost(post);
    setEditingContent(post.content);
    setActionError(null);
  }

  function handleEditDialogChange(open: boolean) {
    if (!open && !savingEdit) {
      setEditingPost(null);
      setEditingContent("");
    }
  }

  async function savePostEdit() {
    if (!user || !editingPost || savingEdit) return;
    const content = editingContent.trim();
    if (!content && !editingPost.media_path) {
      audioManager.play("error");
      setActionError("A publicação não pode ficar vazia.");
      return;
    }

    setSavingEdit(true);
    setActionError(null);
    const { error: updateError } = await getSupabaseBrowserClient()
      .from("posts")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", editingPost.id)
      .eq("author_id", user.id);
    if (updateError) {
      audioManager.play("error");
      setActionError(updateError.message);
    } else {
      setEditingPost(null);
      setEditingContent("");
      audioManager.play("save");
      await load();
    }
    setSavingEdit(false);
  }

  function handleDeleteDialogChange(open: boolean) {
    if (!open && !deletingPost) setPostPendingDeletion(null);
  }

  async function deletePost() {
    if (!user || !postPendingDeletion || deletingPost) return;
    setDeletingPost(true);
    setActionError(null);
    const { error: deleteError } = await getSupabaseBrowserClient()
      .from("posts")
      .delete()
      .eq("id", postPendingDeletion.id)
      .eq("author_id", user.id);
    if (deleteError) {
      audioManager.play("error");
      setActionError(deleteError.message);
    } else {
      await removePostMedia(postPendingDeletion.media_path);
      setPostPendingDeletion(null);
      audioManager.play("remove");
      await load();
    }
    setDeletingPost(false);
  }

  const emptyDescription = !user
    ? "Entre com sua conta para gerenciar suas publicações."
    : "Você ainda não publicou nada.";

  return (
    <WorkspaceLayout
      title="Publicações"
      description="Gerencie as publicações criadas por você."
      action={
        user ? (
          <button
            className="workspace-primary-action"
            onClick={() => setComposerOpen((open) => !open)}
          >
            <Plus size={17} /> Nova publicação
          </button>
        ) : null
      }
    >
      {user && composerOpen ? (
        <form className="workspace-composer" onSubmit={createPost}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Compartilhe uma ideia, oportunidade ou projeto"
            maxLength={300}
          />
          <div>
            <span className="workspace-composer-tools">
              <MediaPicker
                key={mediaPickerKey}
                value={media}
                onChange={setMedia}
                disabled={saving}
                onBusyChange={setMediaBusy}
              />
              {content.length}/300
            </span>
            <button disabled={saving || mediaBusy || (!content.trim() && !media)}>
              {saving ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </form>
      ) : null}
      {actionError ? (
        <p className="workspace-notice" role="alert">
          {actionError}
        </p>
      ) : null}
      {loading ? (
        <WorkspaceSkeleton cards={3} />
      ) : error ? (
        <WorkspaceError
          icon={FileText}
          title="Não foi possível carregar suas publicações"
          description={error}
          onRetry={() => void load()}
        />
      ) : posts.length === 0 ? (
        <WorkspaceEmpty
          icon={FileText}
          title={emptyDescription}
          description={
            user
              ? "Use “Nova publicação” para compartilhar algo com a comunidade."
              : "Enquanto isso, explore oportunidades e descubra quem está criando na Looma."
          }
          action={
            user ? (
              <button
                type="button"
                className="workspace-empty-action"
                onClick={() => setComposerOpen(true)}
              >
                Criar publicação
              </button>
            ) : (
              <Link className="workspace-empty-action" to="/oportunidades">
                Explorar oportunidades
              </Link>
            )
          }
        />
      ) : (
        <section className="workspace-card-list">
          {posts.map((post) => (
            <article className="workspace-card" key={post.id}>
              <div className="workspace-card-heading">
                <div>
                  <span className="workspace-status">
                    {post.kind === "work" ? "Trabalho aberto" : "Publicada"}
                  </span>
                  <time>
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                      new Date(post.created_at),
                    )}
                  </time>
                </div>
                <div className="workspace-inline-actions">
                  <button
                    data-ui-sound="none"
                    onClick={() => openPostEditor(post)}
                    aria-label="Editar publicação"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  <button
                    onClick={() => {
                      setPostPendingDeletion(post);
                      setActionError(null);
                    }}
                    aria-label="Excluir publicação"
                    data-ui-sound="none"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              {post.content ? <p>{post.content}</p> : null}
              <PostMedia path={post.media_path} type={post.media_type} />
              <small>
                {post.likes_count} curtidas · {post.comments_count} comentários
              </small>
            </article>
          ))}
        </section>
      )}
      <Dialog open={editingPost !== null} onOpenChange={handleEditDialogChange}>
        <DialogContent showClose={!savingEdit} className="post-proposal-dialog">
          <DialogHeader>
            <DialogTitle>Editar publicação</DialogTitle>
            <DialogDescription>Atualize o texto da sua publicação.</DialogDescription>
          </DialogHeader>
          <textarea
            className="post-proposal-message"
            value={editingContent}
            onChange={(event) => setEditingContent(event.target.value)}
            maxLength={300}
            disabled={savingEdit}
            autoFocus
          />
          <p className="post-proposal-count">{editingContent.length}/300</p>
          {actionError ? (
            <p className="post-delete-error" role="alert">
              {actionError}
            </p>
          ) : null}
          <DialogFooter className="post-delete-actions">
            <DialogClose asChild>
              <button type="button" className="post-delete-cancel" disabled={savingEdit}>
                Cancelar
              </button>
            </DialogClose>
            <button
              type="button"
              className="post-delete-confirm"
              onClick={() => void savePostEdit()}
              disabled={savingEdit || (!editingContent.trim() && !editingPost?.media_path)}
            >
              {savingEdit ? "Salvando…" : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={postPendingDeletion !== null} onOpenChange={handleDeleteDialogChange}>
        <DialogContent showClose={!deletingPost} className="post-delete-dialog">
          <DialogHeader>
            <DialogTitle className="post-delete-title">Excluir esta publicação?</DialogTitle>
            <DialogDescription className="post-delete-description">
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {actionError ? (
            <p className="post-delete-error" role="alert">
              {actionError}
            </p>
          ) : null}
          <DialogFooter className="post-delete-actions">
            <DialogClose asChild>
              <button type="button" className="post-delete-cancel" disabled={deletingPost}>
                Cancelar
              </button>
            </DialogClose>
            <button
              type="button"
              className="post-delete-confirm"
              onClick={() => void deletePost()}
              disabled={deletingPost}
            >
              {deletingPost ? "Excluindo…" : "Excluir"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}
