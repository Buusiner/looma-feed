import { audioManager } from "@/lib/audio-manager";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  Compass,
  FileText,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LoomaSidebar } from "./Sidebar";
import { AdminVerifiedBadge } from "./AdminVerifiedBadge";
import { MediaPicker } from "./MediaPicker";
import { PostMedia } from "./PostMedia";
import { ProfileAvatar } from "./ProfileAvatar";
import { ComposerTypeToggle } from "./ComposerTypeToggle";
import { getProfileName, getProfileUsername, type Profile, useCurrentProfile } from "@/lib/profile";
import { useAdminAccess } from "@/lib/admin";
import { getConnectionRows, getPeerIds, type ConnectionRow } from "@/lib/activity-metrics";
import {
  MEDIA_COLUMNS,
  isMissingPostMediaColumns,
  removePostMedia,
  uploadPostMedia,
  type PostMediaData,
  type PreparedMedia,
  withEmptyMediaData,
} from "@/lib/media";
import { createWorkProposal, MAX_PROPOSAL_MESSAGE_LENGTH } from "@/lib/proposals";
import { DEMO_OPPORTUNITY_FILTER } from "@/lib/opportunities";
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

type FeedPost = PostMediaData & {
  id: string;
  author_id: string;
  content: string;
  kind: "post" | "work";
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
};

type PendingFeedPost = {
  client_id: string;
  author_id: string;
  content: string;
  kind: "post" | "work";
  mediaPreviewUrl: string | null;
  media_type: string | null;
  pending: true;
};

type FeedListItem = FeedPost | PendingFeedPost;

type FeedTab = "for-you" | "following";
type IntroStage = "logo" | "word" | "line" | "tagline";
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

type HomeOpportunity = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  type: string | null;
  work_mode: string | null;
};

type HomeInterest = {
  id: string;
  name: string;
};

type HomeSearchResult =
  | {
      id: string;
      type: "profile";
      title: string;
      detail: string;
      username: string;
      avatarUrl: string | null;
      isVerified: boolean;
    }
  | {
      id: string;
      type: "opportunity";
      title: string;
      detail: string;
    }
  | {
      id: string;
      type: "post";
      title: string;
      detail: string;
    };

const INTRO_BRAND_TEXT = "ooma";
const INTRO_TAGLINE = "we are building connections";
const INTRO_LOGO_MS = 220;
const INTRO_WORD_FADE_MS = 260;
const INTRO_LINE_DELAY_MS = 80;
const INTRO_LINE_MS = 320;
const INTRO_TAGLINE_HOLD_MS = 300;
const POST_EXIT_ANIMATION_MS = 220;
const POST_PENDING_MINIMUM_MS = 1200;
function formatPostDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `há ${diffDays} d`;

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function formatPostDateTitle(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function searchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function isPendingFeedPost(post: FeedListItem): post is PendingFeedPost {
  return "pending" in post;
}

function getSearchResultKey(result: HomeSearchResult) {
  return `${result.type}-${result.id}`;
}

function SearchBox({
  query,
  results,
  isLoading,
  onQueryChange,
  onPostSelect,
}: {
  query: string;
  results: HomeSearchResult[];
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onPostSelect: (postId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = "looma-search-results";
  const normalizedQuery = query.trim();
  const peopleResults = results.filter((result) => result.type === "profile").slice(0, 4);
  const postResults = results.filter((result) => result.type === "post").slice(0, 4);
  const opportunityResults = results.filter((result) => result.type === "opportunity").slice(0, 4);
  const visibleResults = [...peopleResults, ...postResults, ...opportunityResults];
  const activeResult = visibleResults[activeIndex] ?? null;

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(0);
  }, []);

  const closeAndRestoreFocus = useCallback(() => {
    closePanel();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [closePanel]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closePanel();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closePanel]);

  useEffect(() => {
    const handleSlashShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented) return;
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      setIsOpen(true);
    };

    window.addEventListener("keydown", handleSlashShortcut);
    return () => window.removeEventListener("keydown", handleSlashShortcut);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery, results]);

  function selectResult(result: HomeSearchResult) {
    closePanel();
    if (result.type === "post") {
      onPostSelect(result.id);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (!isOpen && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      setIsOpen(true);
      return;
    }

    if (!visibleResults.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + visibleResults.length) % visibleResults.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const result = visibleResults[activeIndex];
      if (result) selectResult(result);
    }
  }

  const renderResult = (result: HomeSearchResult, index: number) => {
    const optionId = `looma-search-option-${getSearchResultKey(result)}`;
    const isActive = activeIndex === index;
    const optionContent = (
      <>
        <span className="search-result-icon" aria-hidden="true">
          {result.type === "profile" ? (
            <ProfileAvatar
              className="avatar"
              fullName={result.title}
              avatarUrl={result.avatarUrl}
            />
          ) : result.type === "opportunity" ? (
            <BriefcaseBusiness size={16} />
          ) : (
            <FileText size={16} />
          )}
        </span>
        <span className="search-result-copy">
          <strong>
            {result.title}
            {result.type === "profile" && result.isVerified ? <AdminVerifiedBadge /> : null}
          </strong>
          <small>{result.detail}</small>
        </span>
      </>
    );

    if (result.type === "profile") {
      return (
        <Link
          id={optionId}
          key={getSearchResultKey(result)}
          role="option"
          aria-selected={isActive}
          className={isActive ? "is-active" : ""}
          to="/perfil/$username"
          params={{ username: result.username }}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => closePanel()}
        >
          {optionContent}
        </Link>
      );
    }

    if (result.type === "opportunity") {
      return (
        <Link
          id={optionId}
          key={getSearchResultKey(result)}
          role="option"
          aria-selected={isActive}
          className={isActive ? "is-active" : ""}
          to="/oportunidades"
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => closePanel()}
        >
          {optionContent}
        </Link>
      );
    }

    return (
      <button
        id={optionId}
        key={getSearchResultKey(result)}
        type="button"
        role="option"
        aria-selected={isActive}
        className={isActive ? "is-active" : ""}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectResult(result)}
      >
        {optionContent}
      </button>
    );
  };

  const renderGroup = (label: string, groupResults: HomeSearchResult[], offset: number) =>
    groupResults.length ? (
      <section className="search-result-group" key={label}>
        <h3>{label}</h3>
        <div>{groupResults.map((result, index) => renderResult(result, offset + index))}</div>
      </section>
    ) : null;

  return (
    <div ref={wrapRef} className="search-wrap">
      <label className="looma-search">
        <Search size={17} aria-hidden="true" />
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Buscar na Looma"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-activedescendant={
            isOpen && activeResult
              ? `looma-search-option-${getSearchResultKey(activeResult)}`
              : undefined
          }
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar na Looma"
          autoComplete="off"
        />
      </label>
      {isOpen ? (
        <section id={panelId} className="looma-search-results" role="listbox">
          {!normalizedQuery ? (
            <p className="search-results-state">Busque por pessoas, publicações e oportunidades</p>
          ) : isLoading ? (
            <div className="search-results-skeleton" aria-label="Carregando resultados">
              <i />
              <i />
              <i />
            </div>
          ) : visibleResults.length ? (
            <>
              {renderGroup("Pessoas", peopleResults, 0)}
              {renderGroup("Publicações", postResults, peopleResults.length)}
              {renderGroup(
                "Oportunidades",
                opportunityResults,
                peopleResults.length + postResults.length,
              )}
            </>
          ) : (
            <p className="search-results-state">Nenhum resultado para “{normalizedQuery}”</p>
          )}
        </section>
      ) : null}
    </div>
  );
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
  const [introStage, setIntroStage] = useState<IntroStage>("logo");
  const [introSequenceDone, setIntroSequenceDone] = useState(() => !showSplash);
  const [media, setMedia] = useState<PreparedMedia | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaPickerKey, setMediaPickerKey] = useState(0);
  const [message, setMessage] = useState("");
  const [postKind, setPostKind] = useState<FeedPost["kind"]>("post");
  const [feedTab, setFeedTab] = useState<FeedTab>("for-you");
  const [posts, setPosts] = useState<FeedListItem[]>([]);
  const [postProfiles, setPostProfiles] = useState<Record<string, Profile>>({});
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PersonRecommendation[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<HomeOpportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const [interests, setInterests] = useState<HomeInterest[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(true);
  const [interestsError, setInterestsError] = useState<string | null>(null);
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
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set());
  const [proposalPost, setProposalPost] = useState<FeedPost | null>(null);
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearchSettling, setIsSearchSettling] = useState(false);
  const [profileSearchResults, setProfileSearchResults] = useState<Profile[]>([]);
  const [profilesSearchLoading, setProfilesSearchLoading] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const splashWasActiveRef = useRef(showSplash);
  const postRemovalTimerRef = useRef<number | null>(null);
  const { profile, user, isLoading: isProfileLoading } = useCurrentProfile();
  const { isAdmin } = useAdminAccess(user);
  const displayName = getProfileName(profile, user);
  const username = getProfileUsername(profile, user);
  const firstName = user ? displayName.trim().split(/\s+/)[0] || "você" : "você";

  useEffect(() => {
    const query = searchQuery.trim();
    setIsSearchSettling(query.length > 0);
    const sequenceController = new AbortController();
    const timer = window.setTimeout(() => {
      if (sequenceController.signal.aborted) return;
      setDebouncedSearchQuery(searchQuery);
      setIsSearchSettling(false);
    }, 250);

    return () => {
      sequenceController.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const rawQuery = debouncedSearchQuery.trim();
    const profileQuery = rawQuery.replace(/^@+/, "").trim();

    if (profileQuery.length < 2) {
      setProfileSearchResults([]);
      setProfilesSearchLoading(false);
      return;
    }

    let isCurrent = true;
    setProfilesSearchLoading(true);

    const loadProfiles = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const profileResult = await supabase
          .from("profiles")
          .select(
            "id, username, full_name, avatar_url, bio, created_at, onboarding_completed_at, experience_level, is_admin",
          )
          .or(`username.ilike.%${profileQuery}%,full_name.ilike.%${profileQuery}%`)
          .limit(6);

        if (!isCurrent) return;
        if (profileResult.error) throw profileResult.error;
        setProfileSearchResults((profileResult.data ?? []) as Profile[]);
      } catch (caught) {
        if (!isCurrent) return;
        setProfileSearchResults([]);
      } finally {
        if (isCurrent) setProfilesSearchLoading(false);
      }
    };

    void loadProfiles();

    return () => {
      isCurrent = false;
    };
  }, [debouncedSearchQuery]);

  const searchResults = useMemo(() => {
    const query = searchKey(debouncedSearchQuery);
    const usernameQuery = searchKey(debouncedSearchQuery.replace(/^@+/, ""));
    if (!query) return [];

    const matches = (value: string | null | undefined) => {
      const valueKey = searchKey(value ?? "");
      return valueKey.includes(query) || (!!usernameQuery && valueKey.includes(usernameQuery));
    };
    const results: HomeSearchResult[] = [];
    const seenProfileIds = new Set<string>();

    for (const candidate of [
      ...profileSearchResults,
      ...Object.values(postProfiles),
      ...suggestions,
    ]) {
      if (!candidate.username || seenProfileIds.has(candidate.id)) continue;
      if (!matches(candidate.full_name) && !matches(candidate.username)) continue;
      seenProfileIds.add(candidate.id);
      results.push({
        id: candidate.id,
        type: "profile",
        title: candidate.full_name?.trim() || `@${candidate.username}`,
        detail: `@${candidate.username.replace(/^@/, "")}`,
        username: candidate.username.replace(/^@/, ""),
        avatarUrl: candidate.avatar_url,
        isVerified: "is_admin" in candidate ? Boolean(candidate.is_admin) : false,
      });
    }

    for (const opportunity of opportunities) {
      if (!matches(opportunity.title) && !matches(opportunity.description)) continue;
      results.push({
        id: opportunity.id,
        type: "opportunity",
        title: opportunity.title,
        detail: opportunity.category || "Oportunidade",
      });
    }

    for (const post of posts) {
      if (isPendingFeedPost(post) || !matches(post.content)) continue;
      const author = postProfiles[post.author_id];
      results.push({
        id: post.id,
        type: "post",
        title: author?.full_name?.trim() || "Publicação",
        detail: post.content,
      });
    }

    return results.slice(0, 8);
  }, [debouncedSearchQuery, opportunities, postProfiles, posts, profileSearchResults, suggestions]);

  useEffect(() => {
    if (showSplash && !splashWasActiveRef.current) {
      setFeedReady(false);
      setIntroVisible(false);
    }
    splashWasActiveRef.current = showSplash;
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash) {
      setFeedReady(true);
      setIntroVisible(true);
      setIntroStage("tagline");
      setIntroSequenceDone(true);
      return;
    }

    setIntroVisible(false);
    setIntroStage("logo");
    setIntroSequenceDone(false);

    const timers: number[] = [];
    const lineStartsAt = INTRO_LOGO_MS + INTRO_WORD_FADE_MS + INTRO_LINE_DELAY_MS;
    const taglineStartsAt = lineStartsAt + INTRO_LINE_MS;
    const sequenceEndsAt = taglineStartsAt + INTRO_TAGLINE_HOLD_MS;

    timers.push(window.setTimeout(() => setIntroVisible(true), 40));
    timers.push(window.setTimeout(() => setIntroStage("word"), INTRO_LOGO_MS));
    timers.push(window.setTimeout(() => setIntroStage("line"), lineStartsAt));
    timers.push(window.setTimeout(() => setIntroStage("tagline"), taglineStartsAt));
    timers.push(window.setTimeout(() => setIntroSequenceDone(true), sequenceEndsAt));

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash || !introSequenceDone) return;
    if (isProfileLoading || postsLoading || suggestionsLoading) return;

    setFeedReady(true);
    onSplashComplete();
  }, [
    isProfileLoading,
    introSequenceDone,
    onSplashComplete,
    postsLoading,
    showSplash,
    suggestionsLoading,
  ]);

  const loadFeed = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const userId = user?.id;
      let acceptedPeerIds: string[] = [];

      if (feedTab === "following") {
        if (!userId) {
          setPosts([]);
          setPostProfiles({});
          return;
        }
        const connectionResult = await getConnectionRows(supabase, userId);
        if (connectionResult.error) {
          setPostsError(connectionResult.error.message);
          return;
        }
        acceptedPeerIds = [
          ...getPeerIds((connectionResult.data ?? []) as ConnectionRow[], userId, ["accepted"]),
        ];
        if (!acceptedPeerIds.length) {
          setPosts([]);
          setPostProfiles({});
          return;
        }
      }

      let query = supabase
        .from("posts")
        .select(
          `id, author_id, content, kind, likes_count, comments_count, created_at, updated_at, ${MEDIA_COLUMNS}`,
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30);
      if (feedTab === "following") query = query.in("author_id", acceptedPeerIds);

      const postResult = await query;
      let postsData = postResult.data;
      let postsQueryError = postResult.error;
      if (isMissingPostMediaColumns(postsQueryError)) {
        let fallbackQuery = supabase
          .from("posts")
          .select(
            "id, author_id, content, kind, likes_count, comments_count, created_at, updated_at",
          )
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(30);
        if (feedTab === "following") fallbackQuery = fallbackQuery.in("author_id", acceptedPeerIds);
        const fallbackResult = await fallbackQuery;
        postsData = fallbackResult.data?.map(withEmptyMediaData) ?? null;
        postsQueryError = fallbackResult.error;
      }
      if (postsQueryError) {
        setPostsError(postsQueryError.message);
        return;
      }

      const rows = (postsData ?? []) as FeedPost[];
      const authorIds = [...new Set(rows.map((post) => post.author_id))];
      if (!authorIds.length) {
        setPosts([]);
        setPostProfiles({});
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, created_at, is_admin")
        .in("id", authorIds);
      if (profileResult.error) {
        setPostsError(profileResult.error.message);
        return;
      }

      setPosts(rows);
      setPostProfiles(
        Object.fromEntries(
          ((profileResult.data ?? []) as Profile[]).map((item) => [item.id, item]),
        ),
      );
    } catch (caught) {
      setPostsError(caught instanceof Error ? caught.message : "Não foi possível carregar o feed.");
    } finally {
      setPostsLoading(false);
    }
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
    try {
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
    } catch (caught) {
      setSuggestionsError(
        caught instanceof Error ? caught.message : "Não foi possível carregar as recomendações.",
      );
    } finally {
      setSuggestionsLoading(false);
    }
  }, [user?.id]);

  const loadDiscovery = useCallback(async () => {
    setOpportunitiesLoading(true);
    setInterestsLoading(true);
    setOpportunitiesError(null);
    setInterestsError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const [opportunitiesResult, interestsResult] = await Promise.all([
        supabase
          .from("opportunities")
          .select("id, title, description, category, type, work_mode")
          .not("id", "in", DEMO_OPPORTUNITY_FILTER)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase.from("skill_tags").select("id, name").order("name").limit(8),
      ]);

      if (opportunitiesResult.error) {
        setOpportunities([]);
        setOpportunitiesError(opportunitiesResult.error.message);
      } else {
        setOpportunities((opportunitiesResult.data ?? []) as HomeOpportunity[]);
      }

      if (interestsResult.error) {
        setInterests([]);
        setInterestsError(interestsResult.error.message);
      } else {
        setInterests((interestsResult.data ?? []) as HomeInterest[]);
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Não foi possível carregar as descobertas.";
      setOpportunities([]);
      setInterests([]);
      setOpportunitiesError(message);
      setInterestsError(message);
    } finally {
      setOpportunitiesLoading(false);
      setInterestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);
  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);
  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  useEffect(
    () => () => {
      if (postRemovalTimerRef.current !== null) window.clearTimeout(postRemovalTimerRef.current);
    },
    [],
  );

  async function publish() {
    const content = message.trim();
    if ((!content && !media) || publishing || mediaBusy) return;
    if (!user) {
      audioManager.play("error");
      setComposerError("Entre com sua conta para publicar.");
      return;
    }

    const pendingMediaPreviewUrl = media ? URL.createObjectURL(media.file) : null;
    const pendingPost: PendingFeedPost = {
      client_id: crypto.randomUUID(),
      author_id: user.id,
      content,
      kind: postKind,
      mediaPreviewUrl: pendingMediaPreviewUrl,
      media_type: media?.file.type ?? null,
      pending: true,
    };

    setPosts((current) => [pendingPost, ...current]);
    setPublishing(true);
    setComposerError(null);
    const pendingMinimumTimer = new Promise<void>((resolve) => {
      window.setTimeout(resolve, POST_PENDING_MINIMUM_MS);
    });
    let uploadedMediaPath: string | null = null;
    try {
      const mediaData = await uploadPostMedia(user.id, media);
      uploadedMediaPath = mediaData.media_path;
      const result = await getSupabaseBrowserClient()
        .from("posts")
        .insert({
          author_id: user.id,
          content,
          kind: postKind,
          status: "published",
          ...mediaData,
        })
        .select(
          `id, author_id, content, kind, likes_count, comments_count, created_at, updated_at, ${MEDIA_COLUMNS}`,
        )
        .single();
      if (result.error || !result.data) {
        await removePostMedia(uploadedMediaPath);
        setPosts((current) =>
          current.filter(
            (post) => !isPendingFeedPost(post) || post.client_id !== pendingPost.client_id,
          ),
        );
        audioManager.play("error");
        setComposerError(result.error?.message ?? "Não foi possível publicar agora.");
        return;
      }

      const [confirmedResult] = await Promise.all([Promise.resolve(result), pendingMinimumTimer]);
      const newPost = confirmedResult.data as FeedPost;
      setMessage("");
      setMedia(null);
      setMediaPickerKey((current) => current + 1);
      setPostKind("post");
      setPostsError(null);
      setPosts((current) =>
        current.map((post) =>
          isPendingFeedPost(post) && post.client_id === pendingPost.client_id ? newPost : post,
        ),
      );
      setRecentlyAddedPostId(newPost.id);
      audioManager.play("success");
      setFeedTab("for-you");
    } catch (caught) {
      await removePostMedia(uploadedMediaPath);
      setPosts((current) =>
        current.filter(
          (post) => !isPendingFeedPost(post) || post.client_id !== pendingPost.client_id,
        ),
      );
      audioManager.play("error");
      setComposerError(
        caught instanceof Error ? caught.message : "Não foi possível publicar agora.",
      );
    } finally {
      if (pendingMediaPreviewUrl) URL.revokeObjectURL(pendingMediaPreviewUrl);
      setPublishing(false);
    }
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
    if (!content && !post.media_path) {
      audioManager.play("error");
      setPostActionError("A publicação não pode ficar vazia.");
      return;
    }

    setSavingPostId(post.id);
    setPostActionError(null);
    try {
      const result = await getSupabaseBrowserClient()
        .from("posts")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", post.id)
        .eq("author_id", user.id)
        .select(
          `id, author_id, content, kind, likes_count, comments_count, created_at, updated_at, ${MEDIA_COLUMNS}`,
        )
        .single();

      if (result.error || !result.data) {
        audioManager.play("error");
        setPostActionError(result.error?.message ?? "Não foi possível salvar a edição.");
        return;
      }

      const updatedPost = result.data as FeedPost;
      audioManager.play("save");
      setPosts((current) =>
        current.map((item) =>
          !isPendingFeedPost(item) && item.id === updatedPost.id ? updatedPost : item,
        ),
      );
      setEditingPostId(null);
      setEditingPostContent("");
    } catch (caught) {
      audioManager.play("error");
      setPostActionError(
        caught instanceof Error ? caught.message : "Não foi possível salvar a edição.",
      );
    } finally {
      setSavingPostId(null);
    }
  }

  async function deletePost(post: FeedPost) {
    if (!user || user.id !== post.author_id || deletingPostId) return;

    setDeletingPostId(post.id);
    setPostActionError(null);
    try {
      const result = await getSupabaseBrowserClient()
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("author_id", user.id);

      if (result.error) {
        audioManager.play("error");
        setPostActionError(result.error.message);
        setDeletingPostId(null);
        return;
      }

      setRemovingPostId(post.id);
      audioManager.play("remove");
      void removePostMedia(post.media_path);
      setPostPendingDeletion(null);
      postRemovalTimerRef.current = window.setTimeout(() => {
        setPosts((current) =>
          current.filter((item) => isPendingFeedPost(item) || item.id !== post.id),
        );
        setRemovingPostId(null);
        setDeletingPostId(null);
        postRemovalTimerRef.current = null;
      }, POST_EXIT_ANIMATION_MS);
    } catch (caught) {
      audioManager.play("error");
      setPostActionError(
        caught instanceof Error ? caught.message : "Não foi possível excluir a publicação.",
      );
      setDeletingPostId(null);
    }
  }

  async function requestConnection(addresseeId: string) {
    if (!user || connectingId) return;
    setConnectingId(addresseeId);
    setSuggestionsError(null);
    try {
      const result = await getSupabaseBrowserClient()
        .from("connections")
        .insert({ requester_id: user.id, addressee_id: addresseeId, status: "pending" });
      if (result.error) {
        audioManager.play("error");
        setSuggestionsError(result.error.message);
      } else {
        audioManager.play("follow");
        setSuggestions((current) => current.filter((item) => item.id !== addresseeId));
      }
    } catch (caught) {
      audioManager.play("error");
      setSuggestionsError(
        caught instanceof Error ? caught.message : "Não foi possível enviar a solicitação.",
      );
    } finally {
      setConnectingId(null);
    }
  }

  function openProposalDialog(post: FeedPost) {
    if (!user || user.id === post.author_id) return;
    setProposalPost(post);
    setProposalMessage("");
    setProposalError(null);
  }

  function handleProposalDialogChange(open: boolean) {
    if (!open && !sendingProposal) {
      setProposalPost(null);
      setProposalMessage("");
      setProposalError(null);
    }
  }

  async function sendProposal() {
    if (!user || !proposalPost || proposalPost.author_id === user.id || sendingProposal) return;

    const message = proposalMessage.trim();
    if (!message) {
      audioManager.play("error");
      setProposalError("Escreva uma mensagem para enviar sua proposta.");
      return;
    }

    setSendingProposal(true);
    setProposalError(null);
    try {
      const { error: proposalRequestError } = await createWorkProposal(getSupabaseBrowserClient(), {
        senderId: user.id,
        recipientId: proposalPost.author_id,
        postId: proposalPost.id,
        postContent: proposalPost.content,
        message,
      });

      if (proposalRequestError) {
        audioManager.play("error");
        setProposalError(proposalRequestError.message);
      } else {
        setProposalPost(null);
        setProposalMessage("");
        setPostActionError(null);
        audioManager.play("messageSent");
      }
    } catch (caught) {
      audioManager.play("error");
      setProposalError(
        caught instanceof Error ? caught.message : "Não foi possível enviar a proposta.",
      );
    } finally {
      setSendingProposal(false);
    }
  }

  const focusPostFromSearch = (postId: string) => {
    const post = document.querySelector<HTMLElement>(`[data-feed-post-id="${postId}"]`);
    post?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const composerPanel = (
    <section className="home-composer-panel">
      <header className="home-panel-heading">
        <div>
          <p className="home-section-kicker">Para escrever</p>
          <h2>Nova publicação</h2>
        </div>
      </header>
      <section className="composer" aria-label="Criar publicação">
        <ProfileAvatar
          className="avatar avatar-coral"
          fullName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <div className="composer-body">
          <textarea
            ref={composerInputRef}
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="O que está acontecendo?"
            maxLength={1000}
            disabled={publishing}
          />
          <div className="composer-actions">
            <div className="composer-left-actions">
              <MediaPicker
                key={mediaPickerKey}
                value={media}
                onChange={setMedia}
                disabled={publishing}
                onBusyChange={setMediaBusy}
              />
              <ComposerTypeToggle disabled={publishing} value={postKind} onChange={setPostKind} />
            </div>
            <button
              type="button"
              className="publish-button"
              disabled={(!message.trim() && !media) || publishing || mediaBusy}
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
    </section>
  );

  return (
    <main
      className={`looma-transition ${introVisible ? "intro-visible" : ""} intro-stage-${introStage} ${feedReady ? "feed-ready" : ""}`}
    >
      <section className="brand-intro" aria-label={`Looma, ${INTRO_TAGLINE}`}>
        <div className="intro-lockup">
          <span className="looma-logo-mark intro-logo" role="img" aria-label="Looma" />
          <span className="intro-brand-copy">
            <span className="intro-brand-name" aria-hidden="true">
              <span className="intro-brand-reserve">{INTRO_BRAND_TEXT}</span>
              <span className="intro-brand-typed">{INTRO_BRAND_TEXT}</span>
              <span className="intro-brand-fallback">{INTRO_BRAND_TEXT}</span>
            </span>
            <span className="intro-underline" />
          </span>
          <span className="intro-tagline-clip">
            <span className="intro-tagline">{INTRO_TAGLINE}</span>
          </span>
        </div>
      </section>

      <section className="feed-stage" aria-hidden={!feedReady}>
        <LoomaSidebar />
        <div className="home-shell">
          <div className="home-main-scroll">
            <header className="home-command-header home-topbar">
              <div className="home-welcome">
                <p className="home-welcome-label">Seu espaço na Looma</p>
                <h1>Bom dia, {firstName}</h1>
                <p>O que você quer construir hoje?</p>
              </div>
            </header>

            <section className="home-feed-stream" aria-label="Atualizações">
              <section className="feed-column home-feed-panel" aria-label="Feed da Looma">
                <header className="home-panel-heading home-feed-heading">
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
                </header>
                {composerPanel}
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
                          {feedTab === "following" ? "" : "Seu feed"}
                        </p>
                        <h2>
                          {feedTab === "following"
                            ? "Nenhuma publicação ainda"
                            : "Nenhuma publicação ainda"}
                        </h2>
                        <p>
                          {feedTab === "following"
                            ? "Conecte-se com pessoas da sua área para acompanhar projetos, ideias e oportunidades por aqui."
                            : "Escreva uma nova publicação acima para iniciar o movimento."}
                        </p>
                        <Link className="home-empty-secondary" to="/conexoes">
                          Explorar conexões
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
                        author?.full_name?.trim() ||
                        (isAuthor || isPending ? displayName : "Usuário");
                      const authorUsername = author?.username
                        ? `@${author.username.replace(/^@/, "")}`
                        : (isAuthor || isPending) && username.startsWith("@")
                          ? username
                          : "";
                      const isAdminAuthor =
                        author?.is_admin === true ||
                        ((isAuthor || isPending) && (profile?.is_admin === true || isAdmin));
                      const postKey = isPending ? `pending-${post.client_id}` : post.id;
                      const isLongPost =
                        post.content.length > 520 || post.content.split(/\r?\n/).length > 8;
                      const isExpanded =
                        !isPending && isLongPost ? expandedPostIds.has(post.id) : true;
                      const visibleContent =
                        isLongPost && !isExpanded
                          ? `${post.content.slice(0, 520).trimEnd()}…`
                          : post.content;
                      return (
                        <article
                          className={`feed-post ${isPending ? "is-pending" : ""} ${isEntering ? "is-entering" : ""} ${isRemoving ? "is-removing" : ""}`}
                          key={postKey}
                          data-feed-post-id={isPending ? undefined : post.id}
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
                              {author?.username ? (
                                <Link
                                  className="post-author-link"
                                  to="/perfil/$username"
                                  params={{ username: author.username.replace(/^@/, "") }}
                                >
                                  {authorName}
                                  {isAdminAuthor ? <AdminVerifiedBadge /> : null}
                                </Link>
                              ) : (
                                <strong>
                                  {authorName}
                                  {isAdminAuthor ? <AdminVerifiedBadge /> : null}
                                </strong>
                              )}
                              <span>
                                {isPending ? (
                                  "Enviando…"
                                ) : (
                                  <>
                                    {authorUsername ? `${authorUsername} · ` : ""}
                                    <time
                                      dateTime={post.created_at}
                                      title={formatPostDateTitle(post.created_at)}
                                    >
                                      {formatPostDate(post.created_at)}
                                    </time>
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
                                    <div
                                      id={`post-menu-${post.id}`}
                                      className="post-menu"
                                      role="menu"
                                    >
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
                                        data-ui-sound="none"
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
                                  maxLength={1000}
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
                                    disabled={
                                      savingPostId === post.id ||
                                      (!editingPostContent.trim() && !post.media_path)
                                    }
                                  >
                                    {savingPostId === post.id ? "Salvando…" : "Salvar"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {visibleContent ? <p>{visibleContent}</p> : null}
                                {isPending && post.mediaPreviewUrl ? (
                                  post.media_type?.startsWith("video/") ? (
                                    <video
                                      className="post-media"
                                      src={post.mediaPreviewUrl}
                                      controls
                                      playsInline
                                      preload="metadata"
                                    />
                                  ) : (
                                    <img
                                      className="post-media"
                                      src={post.mediaPreviewUrl}
                                      alt="Prévia da mídia da publicação"
                                    />
                                  )
                                ) : !isPending ? (
                                  <PostMedia path={post.media_path} type={post.media_type} />
                                ) : null}
                                {!isPending && isLongPost ? (
                                  <button
                                    type="button"
                                    className="post-see-more"
                                    onClick={() =>
                                      setExpandedPostIds((current) => {
                                        const next = new Set(current);
                                        if (next.has(post.id)) next.delete(post.id);
                                        else next.add(post.id);
                                        return next;
                                      })
                                    }
                                  >
                                    {isExpanded ? "Ver menos" : "Ver mais"}
                                  </button>
                                ) : null}
                              </>
                            )}
                            {!isPending && post.kind === "work" ? (
                              <div className="feed-work-actions">
                                <span className="feed-work-badge">
                                  <BriefcaseBusiness size={14} aria-hidden="true" /> Trabalho aberto
                                </span>
                                {!isAuthor ? (
                                  <button
                                    type="button"
                                    className="feed-work-proposal"
                                    data-ui-sound="none"
                                    onClick={() => openProposalDialog(post)}
                                  >
                                    Enviar proposta
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
              </section>
            </section>
          </div>

          <aside className="home-context-rail" aria-label="Atalhos e descobertas">
            <div className="home-search-area">
              <SearchBox
                query={searchQuery}
                results={searchResults}
                isLoading={isSearchSettling || profilesSearchLoading}
                onQueryChange={setSearchQuery}
                onPostSelect={focusPostFromSearch}
              />
            </div>
            <button
              type="button"
              className="home-discovery-toggle"
              aria-expanded={isDiscoveryOpen}
              aria-controls="home-discovery-content"
              onClick={() => setIsDiscoveryOpen((open) => !open)}
            >
              <Compass size={18} aria-hidden="true" />
              <span>Descubra na Looma</span>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            <div
              id="home-discovery-content"
              className={`home-discovery-content ${isDiscoveryOpen ? "is-expanded" : ""}`}
            >
              <div className="home-discovery-board">
                <section
                  className="home-discovery-section home-opportunities-section"
                  aria-labelledby="home-opportunities-title"
                >
                  <header className="home-section-header">
                    <div>
                      <p className="home-section-kicker">Descubra possibilidades</p>
                      <h2 id="home-opportunities-title">Oportunidades</h2>
                      <p>Vagas, projetos e pedidos publicados pela comunidade.</p>
                    </div>
                    <Link to="/oportunidades">Ver todas</Link>
                  </header>
                  {opportunitiesLoading ? (
                    <div className="home-discovery-skeleton" aria-label="Carregando oportunidades">
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : opportunitiesError ? (
                    <section className="home-discovery-empty" role="alert">
                      <p>Não foi possível carregar oportunidades: {opportunitiesError}</p>
                      <Link to="/oportunidades">Tentar na página de oportunidades</Link>
                    </section>
                  ) : opportunities.length ? (
                    <div className="home-opportunity-grid">
                      {opportunities.map((opportunity) => (
                        <Link
                          className="home-opportunity-card"
                          key={opportunity.id}
                          to="/oportunidades"
                        >
                          <div className="home-opportunity-card-top">
                            <BriefcaseBusiness size={18} aria-hidden="true" />
                            {opportunity.category ? <span>{opportunity.category}</span> : null}
                          </div>
                          <h3>{opportunity.title}</h3>
                          <p>
                            {opportunity.description.length > 150
                              ? `${opportunity.description.slice(0, 150)}…`
                              : opportunity.description}
                          </p>
                          <div className="home-opportunity-meta">
                            {opportunity.type ? <span>{opportunity.type}</span> : null}
                            {opportunity.work_mode ? <span>{opportunity.work_mode}</span> : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <section className="home-discovery-empty">
                      <div>
                        <h3>As próximas oportunidades começam por aqui.</h3>
                        <p>Quando a comunidade publicar algo novo, você verá nesta área.</p>
                      </div>
                      <Link to="/conexoes">Conhecer pessoas para se conectar</Link>
                    </section>
                  )}
                </section>

                <section className="home-discovery-section" aria-labelledby="home-people-title">
                  <header className="home-section-header">
                    <div>
                      <p className="home-section-kicker">Sua rede</p>
                      <h2 id="home-people-title">Pessoas para conhecer</h2>
                      <p>Profissionais que podem somar ao que você está construindo.</p>
                    </div>
                    <Link to="/conexoes">Ver todas</Link>
                  </header>
                  {suggestionsLoading ? (
                    <div
                      className="home-discovery-skeleton"
                      aria-label="Carregando pessoas recomendadas"
                    >
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : suggestionsError ? (
                    <section className="home-discovery-empty" role="alert">
                      <p>Não foi possível carregar pessoas recomendadas: {suggestionsError}</p>
                      <Link to="/conexoes">Ver conexões</Link>
                    </section>
                  ) : suggestions.length ? (
                    <div className="home-people-grid">
                      {suggestions.map((suggestion) => (
                        <article className="home-person-card" key={suggestion.id}>
                          <ProfileAvatar
                            className="avatar"
                            fullName={suggestion.full_name || "Usuário"}
                            avatarUrl={suggestion.avatar_url}
                          />
                          <div>
                            {suggestion.username ? (
                              <Link
                                className="home-person-profile-link"
                                to="/perfil/$username"
                                params={{ username: suggestion.username.replace(/^@/, "") }}
                              >
                                <h3>{suggestion.full_name?.trim() || "Usuário"}</h3>
                              </Link>
                            ) : (
                              <h3>{suggestion.full_name?.trim() || "Usuário"}</h3>
                            )}
                            {suggestion.username ? (
                              <p>@{suggestion.username.replace(/^@/, "")}</p>
                            ) : null}
                            <small>{suggestion.recommendation_reason}</small>
                          </div>
                          <button
                            type="button"
                            disabled={connectingId === suggestion.id}
                            onClick={() => void requestConnection(suggestion.id)}
                          >
                            {connectingId === suggestion.id ? "Enviando…" : "Conectar"}
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <section className="home-discovery-empty">
                      <div>
                        <h3>Sem sugestões por enquanto</h3>
                        <p>
                          Conexões recomendadas aparecerão aqui quando a sua conta estiver pronta.
                        </p>
                      </div>
                      <Link to="/conexoes">Explorar conexões</Link>
                    </section>
                  )}
                </section>
              </div>

              <section className="home-next-steps">
                <div className="home-context-heading">
                  <span className="home-context-icon" aria-hidden="true">
                    <BadgeCheck size={17} />
                  </span>
                  <div>
                    <p className="home-section-kicker">Próximo passo</p>
                    <h2>Construa sua presença.</h2>
                  </div>
                </div>
                <p>Pequenas ações deixam seu perfil pronto para as oportunidades certas.</p>
                <div className="home-next-step-actions">
                  <Link to="/perfil">
                    <Pencil size={16} aria-hidden="true" /> Completar portfólio
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                  <Link to="/oportunidades">
                    <BriefcaseBusiness size={16} aria-hidden="true" /> Explorar oportunidades
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </section>

              <section className="home-trending-card" aria-labelledby="home-trending-title">
                <header>
                  <div>
                    <p className="home-section-kicker">Áreas profissionais</p>
                    <h2 id="home-trending-title">Áreas para explorar</h2>
                  </div>
                  <Compass size={18} aria-hidden="true" />
                </header>
                {interestsLoading ? (
                  <div className="home-trending-skeleton" aria-label="Carregando áreas">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : interestsError ? (
                  <p className="home-trending-state" role="alert">
                    Não foi possível carregar as áreas agora.
                  </p>
                ) : interests.length ? (
                  <div className="home-trending-list">
                    {interests.slice(0, 6).map((interest) => (
                      <Link key={interest.id} to="/oportunidades">
                        {interest.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="home-trending-state">
                    As áreas profissionais aparecerão aqui assim que estiverem disponíveis.
                  </p>
                )}
              </section>

              <section className="home-feed-companion">
                <p className="home-section-kicker">Sua rede</p>
                <h2>Boas conversas viram oportunidades.</h2>
                <p>Conheça profissionais, acompanhe ideias e dê o próximo passo no seu ritmo.</p>
                <Link to="/conexoes" className="home-companion-link">
                  <UsersRound size={16} aria-hidden="true" /> Conhecer pessoas
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </section>
            </div>
          </aside>
        </div>
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
      <Dialog open={proposalPost !== null} onOpenChange={handleProposalDialogChange}>
        <DialogContent showClose={!sendingProposal} className="post-proposal-dialog">
          <DialogHeader>
            <DialogTitle>Enviar proposta</DialogTitle>
            <DialogDescription>
              Escreva uma mensagem de até {MAX_PROPOSAL_MESSAGE_LENGTH.toLocaleString("pt-BR")}{" "}
              caracteres para esta oportunidade de trabalho.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="post-proposal-message"
            value={proposalMessage}
            onChange={(event) => setProposalMessage(event.target.value)}
            maxLength={MAX_PROPOSAL_MESSAGE_LENGTH}
            disabled={sendingProposal}
            placeholder="Conte como você pode ajudar neste trabalho"
            autoFocus
          />
          <p className="post-proposal-count">
            {proposalMessage.length}/{MAX_PROPOSAL_MESSAGE_LENGTH}
          </p>
          {proposalError ? (
            <p className="post-delete-error" role="alert">
              {proposalError}
            </p>
          ) : null}
          <DialogFooter className="post-delete-actions">
            <DialogClose asChild>
              <button type="button" className="post-delete-cancel" disabled={sendingProposal}>
                Cancelar
              </button>
            </DialogClose>
            <button
              type="button"
              className="post-delete-confirm"
              onClick={() => void sendProposal()}
              disabled={sendingProposal || !proposalMessage.trim()}
            >
              {sendingProposal ? "Enviando…" : "Enviar proposta"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
