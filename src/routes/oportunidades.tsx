import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, BriefcaseBusiness, Search } from "lucide-react";
import { LoomaDropdown } from "@/components/looma/LoomaDropdown";
import { WorkspaceEmpty, WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Opportunity = {
  id: string;
  title: string;
  description: string;
  type: string | null;
  category: string | null;
  work_mode: string | null;
  created_at: string;
};

export const Route = createFileRoute("/oportunidades")({ component: OpportunitiesPage });

function OpportunitiesPage() {
  const { user } = useCurrentProfile();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "relevant">("recent");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: opportunitiesError } = await supabase
      .from("opportunities")
      .select("id, title, description, type, category, work_mode, created_at")
      .order("created_at", { ascending: false });

    if (opportunitiesError) {
      setError(opportunitiesError.message);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as Opportunity[]);
    if (user) {
      const { data: saves, error: savesError } = await supabase
        .from("opportunity_saves")
        .select("opportunity_id")
        .eq("user_id", user.id);
      if (savesError) setError(savesError.message);
      else setSavedIds(new Set((saves ?? []).map((save: { opportunity_id: string }) => save.opportunity_id)));
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user?.id]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))], [items]);
  const types = useMemo(() => [...new Set(items.map((item) => item.type).filter((value): value is string => Boolean(value)))], [items]);
  const modes = useMemo(() => [...new Set(items.map((item) => item.work_mode).filter((value): value is string => Boolean(value)))], [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matched = items.filter((item) =>
      (!normalized || `${item.title} ${item.description}`.toLocaleLowerCase().includes(normalized)) &&
      (!category || item.category === category) && (!type || item.type === type) && (!mode || item.work_mode === mode),
    );
    return sort === "recent" ? matched : [...matched].sort((a, b) => a.title.localeCompare(b.title));
  }, [category, items, mode, query, sort, type]);
  useEffect(() => { setVisibleLimit(12); }, [category, mode, query, sort, type]);

  async function toggleSaved(id: string) {
    if (!user) return;
    const wasSaved = savedIds.has(id);
    const supabase = getSupabaseBrowserClient();
    const result = wasSaved
      ? await supabase.from("opportunity_saves").delete().eq("opportunity_id", id).eq("user_id", user.id)
      : await supabase.from("opportunity_saves").insert({ opportunity_id: id, user_id: user.id });
    if (result.error) { setError(result.error.message); return; }
    setSavedIds((current) => { const next = new Set(current); wasSaved ? next.delete(id) : next.add(id); return next; });
  }

  return (
    <WorkspaceLayout title="Oportunidades em alta" description="Encontre oportunidades publicadas pela comunidade Looma.">
      <div className="workspace-toolbar">
        <label className="workspace-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar oportunidades" /></label>
        <LoomaDropdown value={sort} onChange={setSort} ariaLabel="Ordenar oportunidades" options={[{ value: "recent", label: "Mais recentes" }, { value: "relevant", label: "Por título" }]} />
      </div>
      <div className="workspace-filters" aria-label="Filtros de oportunidade">
        {categories.map((value) => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(category === value ? null : value)}>{value}</button>)}
        {types.map((value) => <button key={value} className={type === value ? "active" : ""} onClick={() => setType(type === value ? null : value)}>{value}</button>)}
        {modes.map((value) => <button key={value} className={mode === value ? "active" : ""} onClick={() => setMode(mode === value ? null : value)}>{value}</button>)}
      </div>
      {loading ? <WorkspaceSkeleton cards={4} /> : error ? <WorkspaceError icon={BriefcaseBusiness} title="Não foi possível carregar oportunidades" description={error} onRetry={() => void load()} /> : filtered.length === 0 ? <WorkspaceEmpty icon={BriefcaseBusiness} title="Nenhuma oportunidade publicada ainda" description={items.length ? "Nenhum resultado corresponde aos filtros selecionados." : "Quando uma oportunidade for publicada, ela aparecerá aqui."} /> : (
        <section className="workspace-card-list">
          {filtered.slice(0, visibleLimit).map((item) => <article className="workspace-card" key={item.id}>
            <div className="workspace-card-heading"><div><h2>{item.title}</h2><div className="workspace-badges">{item.category ? <span>{item.category}</span> : null}{item.type ? <span>{item.type}</span> : null}{item.work_mode ? <span>{item.work_mode}</span> : null}</div></div><button className={savedIds.has(item.id) ? "icon-action active" : "icon-action"} onClick={() => void toggleSaved(item.id)} disabled={!user} aria-label={savedIds.has(item.id) ? "Remover dos salvos" : "Salvar oportunidade"}><Bookmark size={18} /></button></div>
            <p>{expandedId === item.id ? item.description : `${item.description.slice(0, 180)}${item.description.length > 180 ? "…" : ""}`}</p>
            <button className="workspace-text-action" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{expandedId === item.id ? "Ocultar detalhes" : "Ver detalhes"}</button>
          </article>)}
          {filtered.length > visibleLimit ? <button className="workspace-load-more" type="button" onClick={() => setVisibleLimit((limit) => limit + 12)}>Carregar mais</button> : null}
        </section>
      )}
    </WorkspaceLayout>
  );
}
