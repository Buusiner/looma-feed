import { useEffect, useRef, useState } from "react";
import { Bell, Heart, Image, MessageCircle, MoreHorizontal, Repeat2, Search, Send, Share, Smile } from "lucide-react";
import { LoomaSidebar } from "./Sidebar";
import { ProfileAvatar } from "./ProfileAvatar";
import { getProfileName, getProfileUsername, type Profile, useCurrentProfile } from "@/lib/profile";
import { getConnectionRows, getPeerIds, type ConnectionRow } from "@/lib/activity-metrics";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type FeedPost = {
  id: string;
  author_id: string;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

type FeedTab = "for-you" | "following";
type SearchPhase = "compact" | "opening-space" | "moving" | "expanded";
type SearchPosition = { left: number; top: number; width: number };

const MOBILE_NAV = [Search, Bell, MessageCircle];
const SEARCH_TRANSITION_MS = 520;

// Mantidos desligados até que existam tabelas e critérios reais para essas features.
export const HOME_FEATURE_FLAGS = {
  showTrendingCommunities: false,
  showInterestRecommendations: false,
} as const;

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function LoomaLanding({ showSplash, onSplashComplete }: { showSplash: boolean; onSplashComplete: () => void }) {
  const [feedReady, setFeedReady] = useState(() => !showSplash);
  const [introVisible, setIntroVisible] = useState(() => !showSplash);
  const [message, setMessage] = useState("");
  const [feedTab, setFeedTab] = useState<FeedTab>("for-you");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postProfiles, setPostProfiles] = useState<Record<string, Profile>>({});
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPosition, setSearchPosition] = useState<SearchPosition | null>(null);
  const [searchInversion, setSearchInversion] = useState<SearchPosition | null>(null);
  const feedStageRef = useRef<HTMLElement>(null);
  const compactSearchAnchorRef = useRef<HTMLDivElement>(null);
  const expandedSearchSlotRef = useRef<HTMLDivElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { profile, user } = useCurrentProfile();
  const displayName = getProfileName(profile, user);
  const username = getProfileUsername(profile, user);

  useEffect(() => {
    if (!showSplash) return;
    const showIntro = window.requestAnimationFrame(() => setIntroVisible(true));
    const timer = window.setTimeout(() => {
      setFeedReady(true);
      onSplashComplete();
    }, 4500);

    return () => {
      window.cancelAnimationFrame(showIntro);
      window.clearTimeout(timer);
    };
  }, [onSplashComplete, showSplash]);

  async function loadFeed() {
    setPostsLoading(true);
    setPostsError(null);
    const supabase = getSupabaseBrowserClient();
    let acceptedPeerIds: string[] = [];

    if (feedTab === "following") {
      if (!user) {
        setPosts([]);
        setPostProfiles({});
        setPostsLoading(false);
        return;
      }
      const connectionResult = await getConnectionRows(supabase, user.id);
      if (connectionResult.error) {
        setPostsError(connectionResult.error.message);
        setPostsLoading(false);
        return;
      }
      acceptedPeerIds = [...getPeerIds((connectionResult.data ?? []) as ConnectionRow[], user.id, ["accepted"])] ;
      if (!acceptedPeerIds.length) {
        setPosts([]);
        setPostProfiles({});
        setPostsLoading(false);
        return;
      }
    }

    let query = supabase
      .from("posts")
      .select("id, author_id, content, likes_count, comments_count, created_at")
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
    setPostProfiles(Object.fromEntries(((profileResult.data ?? []) as Profile[]).map((item) => [item.id, item])));
    setPostsLoading(false);
  }

  async function loadSuggestions() {
    if (!user) {
      setSuggestions([]);
      setSuggestionsError(null);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);
    const supabase = getSupabaseBrowserClient();
    const connectionResult = await getConnectionRows(supabase, user.id);
    if (connectionResult.error) {
      setSuggestionsError(connectionResult.error.message);
      setSuggestionsLoading(false);
      return;
    }

    const unavailableIds = getPeerIds((connectionResult.data ?? []) as ConnectionRow[], user.id, ["accepted", "pending"]);
    const profileResult = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, created_at")
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (profileResult.error) {
      setSuggestionsError(profileResult.error.message);
    } else {
      setSuggestions(((profileResult.data ?? []) as Profile[]).filter((item) => !unavailableIds.has(item.id)).slice(0, 3));
    }
    setSuggestionsLoading(false);
  }

  useEffect(() => { void loadFeed(); }, [feedTab, user?.id]);
  useEffect(() => { void loadSuggestions(); }, [user?.id]);

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
      setSearchInversion({ left: source.left - target.left, top: source.top - target.top, width: source.width / target.width });
      setSearchPhase("moving");
    }, SEARCH_TRANSITION_MS);
    return () => window.clearTimeout(moveTimer);
  }, [searchPhase]);

  useEffect(() => {
    if (searchPhase !== "moving" || !searchInversion) return;
    const playFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setSearchInversion(null)));
    const finishTimer = window.setTimeout(() => setSearchPhase("expanded"), SEARCH_TRANSITION_MS + 34);
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

    setPublishing(true);
    setComposerError(null);
    const result = await getSupabaseBrowserClient().from("posts").insert({ author_id: user.id, content, status: "published" });
    if (result.error) setComposerError(result.error.message);
    else {
      setMessage("");
      setFeedTab("for-you");
    }
    setPublishing(false);
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

  const openSearch = () => { if (searchPhase === "compact") setSearchPhase("opening-space"); };
  const closeSearch = () => { setSearchInversion(null); setSearchPhase("compact"); };
  const isSearchSpaceOpen = searchPhase !== "compact";

  return (
    <main className={`looma-transition ${introVisible ? "intro-visible" : ""} ${feedReady ? "feed-ready" : ""}`}>
      <section className="brand-intro" aria-label="Looma">
        <div className="intro-lockup">
          <span className="looma-logo-mark intro-logo" aria-hidden="true" />
          <div className="intro-brand-copy"><span className="intro-brand-name">looma</span><span className="intro-underline" aria-hidden="true" /></div>
          <span className="intro-tagline-clip"><span className="intro-tagline">We are building connections.</span></span>
        </div>
      </section>

      <section ref={feedStageRef} className="feed-stage" aria-hidden={!feedReady}>
        <LoomaSidebar />
        <div className="feed-layout lg:pl-60">
          <section className="feed-column" aria-label="Feed da Looma">
            <div ref={expandedSearchSlotRef} className={`feed-search-expand-slot ${isSearchSpaceOpen ? "is-expanded" : ""}`} />
            <header className="feed-header"><strong>Início</strong></header>
            <div className="feed-tabs" role="tablist" aria-label="Tipo de feed">
              <button type="button" className={feedTab === "for-you" ? "active" : ""} onClick={() => setFeedTab("for-you")} role="tab" aria-selected={feedTab === "for-you"}>Para você</button>
              <button type="button" className={feedTab === "following" ? "active" : ""} onClick={() => setFeedTab("following")} role="tab" aria-selected={feedTab === "following"}>Seguindo</button>
            </div>
            <section className="composer" aria-label="Criar publicação">
              <ProfileAvatar className="avatar avatar-coral" fullName={displayName} avatarUrl={profile?.avatar_url} />
              <div className="composer-body">
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Compartilhe uma ideia, oportunidade ou projeto" maxLength={300} />
                <div className="composer-actions">
                  <div><button type="button" aria-label="Adicionar imagem"><Image size={18} /></button><button type="button" aria-label="Adicionar emoji"><Smile size={18} /></button></div>
                  <button type="button" className="publish-button" disabled={!message.trim() || publishing} onClick={() => void publish()}>{publishing ? "Publicando…" : "Publicar"} <Send size={15} /></button>
                </div>
                {composerError ? <p className="home-inline-error" role="alert">{composerError}</p> : null}
              </div>
            </section>
            <section className="post-list" aria-label="Publicações recentes">
              {postsLoading ? <div className="home-feed-skeleton" aria-label="Carregando publicações"><i /><i /><i /></div> : postsError ? <p className="home-feed-state" role="alert">Não foi possível carregar as publicações: {postsError}</p> : posts.length === 0 ? <p className="home-feed-state">{feedTab === "following" ? "Conecte-se com outras pessoas para ver as publicações delas aqui." : "Ainda não há publicações para mostrar aqui."}</p> : posts.map((post) => {
                const author = postProfiles[post.author_id];
                const authorName = author?.full_name?.trim() || "Usuário";
                const authorUsername = author?.username ? `@${author.username.replace(/^@/, "")}` : "";
                return <article className="feed-post" key={post.id}>
                  <ProfileAvatar className="avatar" fullName={authorName} avatarUrl={author?.avatar_url} />
                  <div className="post-body">
                    <div className="post-meta"><strong>{authorName}</strong><span>{authorUsername ? `${authorUsername} · ` : ""}{formatPostDate(post.created_at)}</span><button type="button" aria-label="Mais opções"><MoreHorizontal size={18} /></button></div>
                    <p>{post.content}</p>
                    <div className="post-actions"><button type="button" aria-label={`${post.comments_count} comentários`}><MessageCircle size={17} />{post.comments_count || ""}</button><button type="button" aria-label="Recompartilhar"><Repeat2 size={17} /></button><button type="button" aria-label={`${post.likes_count} curtidas`}><Heart size={17} />{post.likes_count || ""}</button><button type="button" aria-label="Compartilhar"><Share size={17} /></button></div>
                  </div>
                </article>;
              })}
            </section>
          </section>
          <aside className="feed-aside" aria-label="Em destaque">
            <div className={`aside-search-compact ${searchPhase === "moving" || searchPhase === "expanded" ? "is-collapsed" : ""}`}><div ref={compactSearchAnchorRef} className="aside-search-anchor" aria-hidden="true" /></div>
            {suggestionsLoading ? <section className="aside-card home-suggestions-skeleton" aria-label="Carregando sugestões"><i /><i /></section> : suggestionsError ? <section className="aside-card home-aside-error" role="alert">Não foi possível carregar sugestões: {suggestionsError}</section> : suggestions.length > 0 ? <section className="aside-card"><p className="aside-label">Pessoas em movimento</p>{suggestions.map((suggestion) => <div className="person" key={suggestion.id}><ProfileAvatar className="avatar" fullName={suggestion.full_name || "Usuário"} avatarUrl={suggestion.avatar_url} /><div><strong>{suggestion.full_name?.trim() || "Usuário"}</strong>{suggestion.username ? <span>@{suggestion.username.replace(/^@/, "")}</span> : null}</div><button type="button" disabled={connectingId === suggestion.id} onClick={() => void requestConnection(suggestion.id)}>{connectingId === suggestion.id ? "Enviando…" : "Conectar"}</button></div>)}</section> : null}
            {HOME_FEATURE_FLAGS.showTrendingCommunities ? <section className="aside-card"><p className="aside-label">Em alta agora</p><h2>Oportunidades que combinam com o seu trabalho.</h2><a href="#comunidades">Explorar comunidades</a></section> : null}
            {HOME_FEATURE_FLAGS.showInterestRecommendations ? <section className="aside-card interests-card"><p className="aside-label">Recomendado para você</p><h2>Interesses para explorar</h2></section> : null}
          </aside>
        </div>
        {searchPosition ? <div ref={searchOverlayRef} className={`feed-search-overlay ${searchPhase === "compact" ? "is-compact" : ""} ${searchInversion ? "is-inverted" : ""}`} style={{ left: searchPosition.left, top: searchPosition.top, width: searchPosition.width, transform: searchInversion ? `translate(${searchInversion.left}px, ${searchInversion.top}px) scaleX(${searchInversion.width})` : undefined }}><label className="aside-search"><Search size={17} aria-hidden="true" /><input ref={searchInputRef} value={searchQuery} onClick={openSearch} onFocus={openSearch} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} placeholder="Buscar na Looma" aria-label="Buscar na Looma" /></label></div> : null}
        <nav className="mobile-feed-nav" aria-label="Navegação principal"><span className="looma-logo-mark mobile-logo" role="img" aria-label="Looma" />{MOBILE_NAV.map((Icon, index) => <button key={index} type="button" aria-label="Navegar"><Icon size={21} /></button>)}</nav>
      </section>
    </main>
  );
}
