import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { LoomaDropdown, type LoomaDropdownOption } from "@/components/looma/LoomaDropdown";
import { WorkspaceEmpty, WorkspaceError, WorkspaceSkeleton } from "@/components/looma/WorkspaceStates";
import { WorkspaceLayout } from "@/components/looma/WorkspaceLayout";
import { type ActivityMetricResults, getActivityMetricResults } from "@/lib/activity-metrics";
import { useCurrentProfile } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PostDate = { created_at: string };
type Period = "1d" | "7d" | "15d" | "30d" | "3m" | "6m" | "1y";

const PERIOD_OPTIONS = [
  { value: "1d", label: "1 dia", days: 1 },
  { value: "7d", label: "7 dias", days: 7 },
  { value: "15d", label: "15 dias", days: 15 },
  { value: "30d", label: "30 dias", days: 30 },
  { value: "3m", label: "3 meses", days: 90 },
  { value: "6m", label: "6 meses", days: 180 },
  { value: "1y", label: "1 ano", days: 365 },
] as const;

const DROPDOWN_PERIOD_OPTIONS: readonly LoomaDropdownOption<Period>[] = PERIOD_OPTIONS.map(({ value, label }) => ({ value, label }));
const CARD_DEFINITIONS: Array<[string, keyof ActivityMetricResults]> = [
  ["Conexões", "connections"],
  ["Propostas enviadas", "proposalsSent"],
  ["Oportunidades vistas", "opportunityViews"],
  ["Publicações", "posts"],
];

export const Route = createFileRoute("/relatorios")({ component: ReportsPage });

function getSinceIso(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);
  return since.toISOString();
}

function emptyMetricResults(): ActivityMetricResults {
  return {
    connections: { value: 0, error: null }, proposalsSent: { value: 0, error: null },
    proposalsReceived: { value: 0, error: null }, posts: { value: 0, error: null },
    opportunitySaves: { value: 0, error: null }, opportunityViews: { value: 0, error: null },
  };
}

function ReportsPage() {
  const { user } = useCurrentProfile();
  const [period, setPeriod] = useState<Period>("1d");
  const [metricResults, setMetricResults] = useState<ActivityMetricResults | null>(null);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [postDates, setPostDates] = useState<PostDate[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const selectedPeriod = PERIOD_OPTIONS.find((option) => option.value === period) ?? PERIOD_OPTIONS[0];
  const periodDescription = selectedPeriod.days === 1 ? "No último dia" : `Nos últimos ${selectedPeriod.label}`;

  async function loadCards() {
    if (!user) {
      setMetricResults(emptyMetricResults());
      setCardsLoading(false);
      return;
    }
    setCardsLoading(true);
    const results = await getActivityMetricResults(getSupabaseBrowserClient(), user.id, { since: getSinceIso(selectedPeriod.days) });
    setMetricResults(results);
    setCardsLoading(false);
  }

  async function loadReport() {
    if (!user) {
      setPostDates([]);
      setReportError(null);
      setReportLoading(false);
      return;
    }
    setReportLoading(true);
    setReportError(null);
    const { data, error } = await getSupabaseBrowserClient()
      .from("posts")
      .select("created_at")
      .eq("author_id", user.id)
      .eq("status", "published")
      .gte("created_at", getSinceIso(selectedPeriod.days));
    if (error) {
      setPostDates([]);
      setReportError(error.message);
    } else {
      setPostDates((data ?? []) as PostDate[]);
    }
    setReportLoading(false);
  }

  useEffect(() => { void loadCards(); void loadReport(); }, [user?.id, period]);

  const chartData = useMemo(() => {
    const since = new Date(getSinceIso(selectedPeriod.days));
    const buckets = new Map<string, number>();
    postDates.filter((post) => new Date(post.created_at) >= since).forEach((post) => {
      const label = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(post.created_at));
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    });
    return [...buckets].map(([label, posts]) => ({ label, posts }));
  }, [postDates, selectedPeriod.days]);

  const tableMetrics = metricResults ? [
    ["Conexões", metricResults.connections.value],
    ["Propostas enviadas", metricResults.proposalsSent.value],
    ["Propostas recebidas", metricResults.proposalsReceived.value],
    ["Publicações", metricResults.posts.value],
    ["Oportunidades salvas", metricResults.opportunitySaves.value],
  ] as Array<[string, number]> : [];
  const hasData = tableMetrics.some(([, value]) => value > 0);

  return (
    <WorkspaceLayout title="Relatórios" description="Uma visão dos dados reais da sua atividade na Looma.">
      <div className="workspace-report-control"><LoomaDropdown value={period} onChange={setPeriod} ariaLabel="Selecionar período do relatório" options={DROPDOWN_PERIOD_OPTIONS} /></div>

      <section className="workspace-metrics workspace-report-summary" aria-label={`Resumo ${periodDescription.toLowerCase()}`}>
        {CARD_DEFINITIONS.map(([label, key]) => {
          const result = metricResults?.[key];
          return <article key={label}>
            <span>{label}</span>
            {cardsLoading ? <i className="report-card-skeleton" aria-label="Carregando" /> : <strong>{result?.error ? "—" : result?.value ?? 0}</strong>}
            <small>{result?.error ? "Erro ao carregar" : periodDescription}</small>
          </article>;
        })}
      </section>

      {reportLoading ? <WorkspaceSkeleton cards={2} /> : reportError ? <WorkspaceError icon={BarChart3} title="Não foi possível carregar os relatórios" description={reportError} onRetry={() => void loadReport()} /> : <>
        <section className="workspace-report-table"><table><thead><tr><th>Métrica</th><th>Valor no período</th></tr></thead><tbody>{hasData ? tableMetrics.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value}</td></tr>) : <tr><td colSpan={2}>Sem dados suficientes para esse período</td></tr>}</tbody></table></section>
        <section className="workspace-chart"><header><h2>Publicações no período</h2><span>Dados publicados por você</span></header>{chartData.length === 0 ? <WorkspaceEmpty icon={BarChart3} title="Sem dados suficientes para gerar o gráfico" description="Publique algo no período selecionado para ver a evolução." /> : <ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="posts" fill="#ff6b4a" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}</section>
      </>}
    </WorkspaceLayout>
  );
}
