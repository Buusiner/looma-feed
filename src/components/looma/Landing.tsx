import { useCallback, useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  FilePenLine,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LoomaSidebar } from "./Sidebar";
import { ProfileAvatar } from "./ProfileAvatar";
import { getProfileName, getProfileUsername, type Profile, useCurrentProfile } from "@/lib/profile";
import { getConnectionRows, getPeerIds, type ConnectionRow } from "@/lib/activity-metrics";
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

type FeedPost = {
  id: string;
  author_id: string;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
};

type PendingFeedPost = {
  client_id: string;
  author_id: string;
  content: string;
  pending: true;
};

type FeedListItem = FeedPost | PendingFeedPost;

type FeedTab = "for-you" | "following";
type SearchPhase = "compact" | "opening-space" | "moving" | "expanded";
type SearchPosition = { left: number; top: number; width: number };
type PersonRecommendation = Pick<Profile, "avatar_url" | "full_name" | "username"> & {
  id: string;
  recommendation_reason: string;
};

type PeopleInMotionRow = {
  profile_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  recommendation_reason: string;
};

const SEARCH_TRANSITION_MS = 520;
const LOGO_SPLASH_MS = 1000;
const POST_EXIT_ANIMATION_MS = 220;
const POST_PENDING_MINIMUM_MS = 1200;

export const HOME_FEATURE_FLAGS = {
  showTrendingCommunities: true,
  showInterestRecommendations: true,
} as const;

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function isPendingFeedPost(post: FeedListItem): post is PendingFeedPost {
  return "pending" in post;
}

export function LoomaLanding({
  showSplash,
  onSplashComplete,
}: {
  showSplash: boolean;
  onSplashComplete: () => void;
}) {
  const [feedReady, setFeedReady] = useState(() => !showSplash);
  const [introVisible, setIntroVisible] = useState(() => !showSplash);
  const [logoMinimumElapsed, setLogoMinimumElapsed] = useState(() => !showSplash);
  const [message, setMessage] = useState("");
  const [feedTab, setFeedTab] = useState<FeedTab>("for-you");
  const [posts, setPosts] = useState<FeedListItem[]>([]);
  const [postProfiles, setPostProfiles] = useState<Record<string, Profile>>({});
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PersonRecommendation[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [activePostMenuId, setActivePostMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [postPendingDeletion, setPostPendingDeletion] = useState<FeedPost | null>(null);
  const [removingPostId, setRemovingPostId] = useState<string | null>(null);
  const [recentlyAddedPostId, setRecentlyAddedPostId] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPosition, setSearchPosition] = useState<SearchPosition | null>(null);
  const [searchInversion, setSearchInversion] = useState<SearchPosition | null>(null);
  const feedStageRef = useRef<HTMLElement>(null);
  const compactSearchAnchorRef = useRef<HTMLDivElement>(null);
  const expandedSearchSlotRef = useRef<HTMLDivElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const splashWasActiveRef = useRef(showSplash);
  const postRemovalTimerRef = useRef<number | null>(null);
  const { profile, user, isLoading: isProfileLoading } = useCurrentProfile();
  const displayName = getProfileName(profile, user);
  const username = getProfileUsername(profile, user);

  useEffect(() => {
    if (showSplash && !splashWasActiveRef.current) {
      setFeedReady(false);
      setIntroVisible(false);
      setLogoMinimumElapsed(false);
    }
    splashWasActiveRef.current = showSplash;
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = window.setTimeout(() => setLogoMinimumElapsed(true), LOGO_SPLASH_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash || !logoMinimumElapsed) return;
    if (isProfileLoading || postsLoading || suggestionsLoading) return;

    setFeedReady(true);
    onSplashComplete();
  }, [
    isProfileLoading,
    logoMinimumElapsed,
    onSplashComplete,
    postsLoading,
    showSplash,
    suggestionsLoading,
  ]);

  const loadFeed = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    const supabase = getSupabaseBrowserClient();
    const userId = user?.id;
    let acceptedPeerIds: string[] = [];

    if (feedTab === "following") {
      if (!userId) {
        setPosts([]);
        setPostProfiles({});
        setPostsLoading(false);
        return;
      }
      const connectionResult = await getConnectionRows(supabase, userId);
      if (connectionResult.error) {
        setPostsError(connectionResult.error.message);
        setPostsLoading(false);
        return;
      }
      acceptedPeerIds = [
        ...getPeerIds((connectionResult.data ?? []) as ConnectionRow[], userId, ["accepted"]),
      ];
      if (!acceptedPeerIds.length) {
        setPosts([]);
        setPostProfiles({});
        setPostsLoading(false);
        return;
      }
    }

    let query = supabase
      .from("posts")
      .select("id, author_id, content, likes_count, comments_count, created_at, updated_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30);
    if (feedTab === "following") query = query.in("author_id", acceptedPeerIds);

    const postResult = await query;
    if (postResult.error) {
      setPostsError(postResult.error.message);
      setPostsLoading(false);
      return;
    }

    const rows = (postResult.data ?? []) as FeedPost[];
    const authorIds = [...new Set(rows.map((post) => post.author_id))];
    if (!authorIds.length) {
      setPosts([]);
      setPostProfiles({});
      setPostsLoading(false);
      return;
    }

    const profileResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, created_at")
      .in("id", authorIds);
    if (profileResult.error) {
      setPostsError(profileResult.error.message);
      setPostsLoading(false);
      return;
    }

    setPosts(rows);
    setPostProfiles(
      Object.fromEntries(((profileResult.data ?? []) as Profile[]).map((item) => [item.id, item])),
    );
    setPostsLoading(false);
  }, [feedTab, user?.id]);

  const loadSuggestions = useCallback(async () => {
    if (!user?.id) {
      setSuggestions([]);
      setSuggestionsError(null);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);
    const recommendationResult = await getSupabaseBrowserClient().rpc("get_people_in_motion", {
      result_limit: 3,
    });
    if (recommendationResult.error) {
      setSuggestionsError(recommendationResult.error.message);
    } else {
      const recommendationRows = (recommendationResult.data ?? []) as PeopleInMotionRow[];
      setSuggestions(
        recommendationRows.map((item) => ({
          id: item.profile_id,
          full_name: item.full_name,
          username: item.username,
          avatar_url: item.avatar_url,
          recommendation_reason: item.recommendation_reason,
        })),
      );
    }
    setSuggestionsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);
  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  useEffect(
    () => () => {
      if (postRemovalTimerRef.current !== null) window.clearTimeout(postRemovalTimerRef.current);
    },
    [],
  );

  const toStagePosition = (rect: DOMRect): SearchPosition | null => {
    const stageRect = feedStageRef.current?.getBoundingClientRect();
    if (!stageRect) return null;
    return { left: rect.left - stageRect.left, top: rect.top - stageRect.top, width: rect.width };
  };

  useEffect(() => {
    if (searchPhase !== "compact") return;
    const syncCompactPosition = () => {
      const anchor = compactSearchAnchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const nextPosition = toStagePosition(anchor);
      if (nextPosition) setSearchPosition(nextPosition);
    };
    const initialFrame = window.requestAnimationFrame(syncCompactPosition);
    window.addEventListener("resize", syncCompactPosition);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("resize", syncCompactPosition);
    };
  }, [searchPhase]);

  useEffect(() => {
    if (searchPhase !== "opening-space") return;
    const moveTimer = window.setTimeout(() => {
      const source = searchOverlayRef.current?.getBoundingClientRect();
      const target = expandedSearchSlotRef.current?.getBoundingClientRect();
      if (!source || !target) return setSearchPhase("expanded");
      const targetPosition = toStagePosition(target);
      if (!targetPosition) return setSearchPhase("expanded");
      setSearchPosition(targetPosition);
      setSearchInversion({
        left: source.left - target.left,
        top: source.top - target.top,
        width: source.width / target.width,
      });
      setSearchPhase("moving");
    }, SEARCH_TRANSITION_MS);
    return () => window.clearTimeout(moveTimer);
  }, [searchPhase]);

  useEffect(() => {
    if (searchPhase !== "moving" || !searchInversion) return;
    const playFrame = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => setSearchInversion(null)),
    );
    const finishTimer = window.setTimeout(
      () => setSearchPhase("expanded"),
      SEARCH_TRANSITION_MS + 34,
    );
    return () => {
      window.cancelAnimationFrame(playFrame);
      window.clearTimeout(finishTimer);
    };
  }, [searchInversion, searchPhase]);

  async function publish() {
    const content = message.trim();
    if (!content || publishing) return;
    if (!user) {
      setComposerError("Entre com sua conta para publicar.");
      return;
    }

    const pendingPost: PendingFeedPost = {
      client_id: crypto.randomUUID(),
      author_id: user.id,
      content,
      pending: true,
    };

    setPosts((current) => [pendingPost, ...current]);
    setPublishing(true);
    setComposerError(null);
    const pendingMinimumTimer = new Promise<void>((resolve) => {
      window.setTimeout(resolve, POST_PENDING_MINIMUM_MS);
    });
    const result = await getSupabaseBrowserClient()
      .from("posts")
      .insert({ author_id: user.id, content, status: "published" })
      .select("id, author_id, content, likes_count, comments_count, created_at, updated_at")
      .single();
    if (result.error || !result.data) {
      setPosts((current) =>
        current.filter(
          (post) => !isPendingFeedPost(post) || post.client_id !== pendingPost.client_id,
        ),
      );
      setComposerError(result.error?.message ?? "Não foi possível publicar agora.");
    } else {
      const [confirmedResult] = await Promise.all([Promise.resolve(result), pendingMinimumTimer]);
      const newPost = confirmedResult.data as FeedPost;
      setMessage("");
      setPostsError(null);
      setPosts((current) =>
        current.map((post) =>
          isPendingFeedPost(post) && post.client_id === pendingPost.client_id ? newPost : post,
        ),
      );
      setRecentlyAddedPostId(newPost.id);
      setFeedTab("for-you");
    }
    setPublishing(false);
  }

  function startPostEdit(post: FeedPost) {
    setActivePostMenuId(null);
    setPostActionError(null);
    setEditingPostId(post.id);
    setEditingPostContent(post.content);
  }

  function cancelPostEdit() {
    setEditingPostId(null);
    setEditingPostContent("");
    setPostActionError(null);
  }

  function requestPostDeletion(post: FeedPost) {
    setActivePostMenuId(null);
    setPostActionError(null);
    setPostPendingDeletion(post);
  }

  function handlePostDeletionDialogChange(open: boolean) {
    if (!open && !deletingPostId) {
      setPostPendingDeletion(null);
      setPostActionError(null);
    }
  }

  async function savePostEdit(post: FeedPost) {
    const content = editingPostContent.trim();
    if (!user || user.id !== post.author_id || savingPostId) return;
    if (!content) {
      setPostActionError("A publicação não pode ficar vazia.");
      return;
    }

    setSavingPostId(post.id);
    setPostActionError(null);
    const result = await getSupabaseBrowserClient()
      .from("posts")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("author_id", user.id)
      .select("id, author_id, content, likes_count, comments_count, created_at, updated_at")
      .single();

    if (result.error || !result.data) {
      setPostActionError(result.error?.message ?? "Não foi possível salvar a edição.");
    } else {
      const updatedPost = result.data as FeedPost;
      setPosts((current) =>
        current.map((item) =>
          !isPendingFeedPost(item) && item.id === updatedPost.id ? updatedPost : item,
        ),
      );
      setEditingPostId(null);
      setEditingPostContent("");
    }
    setSavingPostId(null);
  }

  async function deletePost(post: FeedPost) {
    if (!user || user.id !== post.author_id || deletingPostId) return;

    setDeletingPostId(post.id);
    setPostActionError(null);
    const result = await getSupabaseBrowserClient()
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("author_id", user.id);

    if (result.error) {
      setPostActionError(result.error.message);
      setDeletingPostId(null);
      return;
    }

    setRemovingPostId(post.id);
    setPostPendingDeletion(null);
    postRemovalTimerRef.current = window.setTimeout(() => {
      setPosts((current) =>
        current.filter((item) => isPendingFeedPost(item) || item.id !== post.id),
      );
      setRemovingPostId(null);
      setDeletingPostId(null);
      postRemovalTimerRef.current = null;
    }, POST_EXIT_ANIMATION_MS);
  }

  async function requestConnection(addresseeId: string) {
    if (!user || connectingId) return;
    setConnectingId(addresseeId);
    setSuggestionsError(null);
    const result = await getSupabaseBrowserClient()
      .from("connections")
      .insert({ requester_id: user.id, addressee_id: addresseeId, status: "pending" });
    if (result.error) setSuggestionsError(result.error.message);
    else setSuggestions((current) => current.filter((item) => item.id !== addresseeId));
    setConnectingId(null);
  }

  const openSearch = () => {
    if (searchPhase === "compact") setSearchPhase("opening-space");
  };
  const closeSearch = () => {
    setSearchInversion(null);
    setSearchPhase("compact");
  };
  const isSearchSpaceOpen = searchPhase !== "compact";
  const focusComposer = () => composerInputRef.current?.focus();

  return (
    <main
      className={`looma-transition ${introVisible ? "intro-visible" : ""} ${feedReady ? "feed-ready" : ""}`}
    >
      <section className="brand-intro intro-loading" aria-label="Looma">
        <span className="looma-logo-mark intro-logo-static" role="img" aria-label="Looma" />
      </section>

      <section ref={feedStageRef} className="feed-stage" aria-hidden={!feedReady}>
        <LoomaSidebar />
        <div className="feed-layout lg:pl-60">
          <section className="feed-column" aria-label="Feed da Looma">
            <div
              ref={expandedSearchSlotRef}
              className={`feed-search-expand-slot ${isSearchSpaceOpen ? "is-expanded" : ""}`}
            />
            <header className="feed-header">
              <strong>Início</strong>
            </header>
            <div className="feed-tabs" role="tablist" aria-label="Tipo de feed">
              <button
                type="button"
                className={feedTab === "for-you" ? "active" : ""}
                onClick={() => setFeedTab("for-you")}
                role="tab"
                aria-selected={feedTab === "for-you"}
              >
                Para você
              </button>
              <button
                type="button"
                className={feedTab === "following" ? "active" : ""}
                onClick={() => setFeedTab("following")}
                role="tab"
                aria-selected={feedTab === "following"}
              >
                Seguindo
              </button>
            </div>
            <section className="composer" aria-label="Criar publicação">
              <ProfileAvatar
                className="avatar avatar-coral"
                fullName={displayName}
                avatarUrl={profile?.avatar_url ?? null}
              />
              <div className="composer-body">
                <textarea
                  ref={composerInputRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Compartilhe uma ideia, oportunidade ou projeto"
                  maxLength={300}
                  disabled={publishing}
                />
                <div className="composer-actions">
                  <button
                    type="button"
                    className="publish-button"
                    disabled={!message.trim() || publishing}
                    onClick={() => void publish()}
                  >
                    {publishing ? "Publicando…" : "Publicar"} <Send size={15} />
                  </button>
                </div>
                {composerError ? (
                  <p className="home-inline-error" role="alert">
                    {composerError}
                  </p>
                ) : null}
              </div>
            </section>
            <section className="post-list" aria-label="Publicações recentes">
              {postActionError ? (
                <p className="home-inline-error post-action-error" role="alert">
                  {postActionError}
                </p>
              ) : null}
              {postsLoading ? (
                <div className="home-feed-skeleton" aria-label="Carregando publicações">
                  <i />
                  <i />
                  <i />
                </div>
              ) : postsError ? (
                <p className="home-feed-state" role="alert">
                  Não foi possível carregar as publicações: {postsError}
                </p>
              ) : posts.length === 0 ? (
                <section className="home-feed-empty">
                  <div>
                    <p className="home-feed-empty-eyebrow">
                      {feedTab === "following" ? "Sua rede" : "Seu espaço está pronto"}
                    </p>
                    <h2>
                      {feedTab === "following"
                        ? "Comece pelas suas próximas conexões"
                        : "Compartilhe o que está acontecendo"}
                    </h2>
                    <p>
                      {feedTab === "following"
                        ? "Conecte-se com pessoas da sua área para acompanhar projetos, ideias e oportunidades por aqui."
                        : "Publique uma ideia, explore oportunidades ou deixe seu portfólio pronto para novas conversas."}
                    </p>
                  </div>
                  <div className="home-empty-actions">
                    {feedTab === "for-you" ? (
                      <button type="button" className="home-empty-primary" onClick={focusComposer}>
                        <FilePenLine size={16} aria-hidden="true" /> Fazer uma publicação
                      </button>
                    ) : null}
                    <Link to="/oportunidades" className="home-empty-link">
                      <BriefcaseBusiness size={16} aria-hidden="true" /> Explorar oportunidades
                    </Link>
                    <Link to="/conexoes" className="home-empty-link">
                      <UserRound size={16} aria-hidden="true" /> Conhecer pessoas
                    </Link>
                    <Link to="/perfil" className="home-empty-link">
                      <Pencil size={16} aria-hidden="true" /> Completar portfólio
                    </Link>
                  </div>
                </section>
              ) : (
                posts.map((post) => {
                  const isPending = isPendingFeedPost(post);
                  const author = postProfiles[post.author_id];
                  const isAuthor = !isPending && user?.id === post.author_id;
                  const isEditing = !isPending && editingPostId === post.id;
                  const isEntering = !isPending && recentlyAddedPostId === post.id;
                  const isRemoving = !isPending && removingPostId === post.id;
                  const authorName =
                    author?.full_name?.trim() || (isAuthor || isPending ? displayName : "Usuário");
                  const authorUsername = author?.username
                    ? `@${author.username.replace(/^@/, "")}`
                    : (isAuthor || isPending) && username.startsWith("@")
                      ? username
                      : "";
                  const postKey = isPending ? `pending-${post.client_id}` : post.id;
                  return (
                    <article
                      className={`feed-post ${isPending ? "is-pending" : ""} ${isEntering ? "is-entering" : ""} ${isRemoving ? "is-removing" : ""}`}
                      key={postKey}
                      onAnimationEnd={(event) => {
                        if (event.animationName === "feed-post-enter" && isEntering)
                          setRecentlyAddedPostId(null);
                      }}
                    >
                      <ProfileAvatar
                        className="avatar"
                        fullName={authorName}
                        avatarUrl={
                          author?.avatar_url ??
                          (isAuthor || isPending ? (profile?.avatar_url ?? null) : null)
                        }
                      />
                      <div className="post-body">
                        <div className="post-meta">
                          <strong>{authorName}</strong>
                          <span>
                            {isPending ? (
                              "Enviando…"
                            ) : (
                              <>
                                {authorUsername ? `${authorUsername} · ` : ""}
                                {formatPostDate(post.created_at)}
                              </>
                            )}
                          </span>
                          {isAuthor ? (
                            <div className="post-menu-wrap">
                              <button
                                type="button"
                                className="post-menu-trigger"
                                aria-label="Opções da publicação"
                                aria-expanded={activePostMenuId === post.id}
                                aria-controls={`post-menu-${post.id}`}
                                onClick={() =>
                                  setActivePostMenuId((current) =>
                                    current === post.id ? null : post.id,
                                  )
                                }
                              >
                                <MoreHorizontal size={18} aria-hidden="true" />
                              </button>
                              {activePostMenuId === post.id ? (
                                <div id={`post-menu-${post.id}`} className="post-menu" role="menu">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => startPostEdit(post)}
                                    disabled={deletingPostId === post.id}
                                  >
                                    <Pencil size={15} aria-hidden="true" /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="post-menu-delete"
                                    onClick={() => requestPostDeletion(post)}
                                    disabled={deletingPostId === post.id}
                                  >
                                    <Trash2 size={15} aria-hidden="true" />{" "}
                                    {deletingPostId === post.id ? "Excluindo…" : "Excluir"}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {isEditing ? (
                          <div className="post-edit-form">
                            <textarea
                              value={editingPostContent}
                              onChange={(event) => setEditingPostContent(event.target.value)}
                              maxLength={300}
                              aria-label="Editar publicação"
                              autoFocus
                            />
                            <div className="post-edit-actions">
                              <button
                                type="button"
                                className="post-edit-cancel"
                                onClick={cancelPostEdit}
                                disabled={savingPostId === post.id}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="post-edit-save"
                                onClick={() => void savePostEdit(post)}
                                disabled={savingPostId === post.id || !editingPostContent.trim()}
                              >
                                {savingPostId === post.id ? "Salvando…" : "Salvar"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p>{post.content}</p>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </section>
          <aside className="feed-aside" aria-label="Em destaque">
            <div
              className={`aside-search-compact ${searchPhase === "moving" || searchPhase === "expanded" ? "is-collapsed" : ""}`}
            >
              <div
                ref={compactSearchAnchorRef}
                className="aside-search-anchor"
                aria-hidden="true"
              />
            </div>
            {suggestionsLoading ? (
              <section
                className="aside-card home-suggestions-skeleton"
                aria-label="Carregando sugestões"
              >
                <i />
                <i />
              </section>
            ) : suggestionsError ? (
              <section className="aside-card home-aside-error" role="alert">
                Não foi possível carregar sugestões: {suggestionsError}
              </section>
            ) : suggestions.length > 0 ? (
              <section className="aside-card">
                <p className="aside-label">Pessoas em movimento</p>
                {suggestions.map((suggestion) => (
                  <div className="person" key={suggestion.id}>
                    <ProfileAvatar
                      className="avatar"
                      fullName={suggestion.full_name || "Usuário"}
                      avatarUrl={suggestion.avatar_url}
                    />
                    <div>
                      <strong>{suggestion.full_name?.trim() || "Usuário"}</strong>
                      {suggestion.username ? (
                        <span>@{suggestion.username.replace(/^@/, "")}</span>
                      ) : null}
                      <small className="person-reason">{suggestion.recommendation_reason}</small>
                    </div>
                    <button
                      type="button"
                      disabled={connectingId === suggestion.id}
                      onClick={() => void requestConnection(suggestion.id)}
                    >
                      {connectingId === suggestion.id ? "Enviando…" : "Conectar"}
                    </button>
                  </div>
                ))}
              </section>
            ) : (
              <section className="aside-card home-people-empty">
                <p className="aside-label">Pessoas para conhecer</p>
                <h2>Amplie sua rede com intenção.</h2>
                <p>Encontre profissionais, criadores e parceiros para seu próximo projeto.</p>
                <Link to="/conexoes">Explorar conexões</Link>
              </section>
            )}
            {HOME_FEATURE_FLAGS.showTrendingCommunities ? (
              <section className="aside-card opportunity-spotlight">
                <p className="aside-label">Oportunidades para você</p>
                <h2>Projetos que podem combinar com seu próximo passo.</h2>
                <p>
                  Explore oportunidades publicadas pela comunidade e salve as que fazem sentido.
                </p>
                <Link to="/oportunidades">Ver oportunidades</Link>
              </section>
            ) : null}
            {HOME_FEATURE_FLAGS.showInterestRecommendations ? (
              <section className="aside-card interests-card">
                <p className="aside-label">Explore por interesse</p>
                <h2>Encontre pessoas no seu universo.</h2>
                <div className="interest-chips">
                  <span>Design</span>
                  <span>Audiovisual</span>
                  <span>Negócios digitais</span>
                </div>
                <Link to="/conexoes">Conhecer pessoas</Link>
              </section>
            ) : null}
          </aside>
        </div>
        {searchPosition ? (
          <div
            ref={searchOverlayRef}
            className={`feed-search-overlay ${searchPhase === "compact" ? "is-compact" : ""} ${searchInversion ? "is-inverted" : ""}`}
            style={{
              left: searchPosition.left,
              top: searchPosition.top,
              width: searchPosition.width,
              transform: searchInversion
                ? `translate(${searchInversion.left}px, ${searchInversion.top}px) scaleX(${searchInversion.width})`
                : undefined,
            }}
          >
            <label className="aside-search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onClick={openSearch}
                onFocus={openSearch}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeSearch();
                }}
                placeholder="Buscar na Looma"
                aria-label="Buscar na Looma"
              />
            </label>
          </div>
        ) : null}
        <nav className="mobile-feed-nav" aria-label="Looma">
          <span className="looma-logo-mark mobile-logo" role="img" aria-label="Looma" />
        </nav>
      </section>
      <Dialog open={postPendingDeletion !== null} onOpenChange={handlePostDeletionDialogChange}>
        <DialogContent
          showClose={false}
          className="post-delete-dialog"
          onEscapeKeyDown={(event) => {
            if (deletingPostId) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (deletingPostId) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="post-delete-title">Excluir esta publicação?</DialogTitle>
            <DialogDescription className="post-delete-description">
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {postActionError ? (
            <p className="post-delete-error" role="alert">
              {postActionError}
            </p>
          ) : null}
          <DialogFooter className="post-delete-actions">
            <DialogClose asChild>
              <button
                type="button"
                className="post-delete-cancel"
                disabled={deletingPostId !== null}
              >
                Cancelar
              </button>
            </DialogClose>
            <button
              type="button"
              className="post-delete-confirm"
              onClick={() => {
                if (postPendingDeletion) void deletePost(postPendingDeletion);
              }}
              disabled={deletingPostId !== null}
            >
              {deletingPostId ? "Excluindo…" : "Excluir"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
