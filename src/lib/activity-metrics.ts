import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityMetrics = {
  connections: number;
  proposalsSent: number;
  proposalsReceived: number;
  posts: number;
  opportunitySaves: number;
  opportunityViews: number;
};

export type ActivityMetricResult = {
  value: number;
  error: string | null;
};

export type ActivityMetricResults = Record<keyof ActivityMetrics, ActivityMetricResult>;

type ActivityMetricsOptions = {
  since?: string;
};

/**
 * Fonte única das contagens pessoais usadas na Home e em Relatórios.
 * O filtro de período é opcional para que a Home represente o total atual.
 */
export async function getActivityMetricResults(
  supabase: SupabaseClient,
  userId: string,
  options: ActivityMetricsOptions = {},
): Promise<ActivityMetricResults> {
  const connections = supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const proposalsSent = supabase
    .from("proposals")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId);
  const proposalsReceived = supabase
    .from("proposals")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId);
  const posts = supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .eq("status", "published");
  const opportunitySaves = supabase
    .from("opportunity_saves")
    .select("opportunity_id", { count: "exact", head: true })
    .eq("user_id", userId);
  const opportunityViews = supabase
    .from("opportunity_views")
    .select("opportunity_id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (options.since) {
    connections.gte("created_at", options.since);
    proposalsSent.gte("created_at", options.since);
    proposalsReceived.gte("created_at", options.since);
    posts.gte("created_at", options.since);
    opportunitySaves.gte("created_at", options.since);
    opportunityViews.gte("created_at", options.since);
  }

  const [connectionResult, sentResult, receivedResult, postsResult, savesResult, viewsResult] = await Promise.all([
    connections,
    proposalsSent,
    proposalsReceived,
    posts,
    opportunitySaves,
    opportunityViews,
  ]);

  return {
    connections: { value: connectionResult.count ?? 0, error: connectionResult.error?.message ?? null },
    proposalsSent: { value: sentResult.count ?? 0, error: sentResult.error?.message ?? null },
    proposalsReceived: { value: receivedResult.count ?? 0, error: receivedResult.error?.message ?? null },
    posts: { value: postsResult.count ?? 0, error: postsResult.error?.message ?? null },
    opportunitySaves: { value: savesResult.count ?? 0, error: savesResult.error?.message ?? null },
    opportunityViews: { value: viewsResult.count ?? 0, error: viewsResult.error?.message ?? null },
  };
}

export async function getActivityMetrics(
  supabase: SupabaseClient,
  userId: string,
  options: ActivityMetricsOptions = {},
) {
  const results = await getActivityMetricResults(supabase, userId, options);
  const error = Object.values(results).find((result) => result.error)?.error;
  if (error) return { data: null, error: { message: error } };

  return {
    data: {
      connections: results.connections.value,
      proposalsSent: results.proposalsSent.value,
      proposalsReceived: results.proposalsReceived.value,
      posts: results.posts.value,
      opportunitySaves: results.opportunitySaves.value,
      opportunityViews: results.opportunityViews.value,
    } satisfies ActivityMetrics,
    error: null,
  };
}

export type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export async function getConnectionRows(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
}

export function getPeerIds(rows: ConnectionRow[], userId: string, statuses?: ConnectionRow["status"][]) {
  return new Set(
    rows
      .filter((row) => !statuses || statuses.includes(row.status))
      .map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id)),
  );
}
