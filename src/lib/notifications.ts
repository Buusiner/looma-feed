import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationEventType =
  "like" | "comment" | "repost" | "retweet" | "connection_request" | "proposal" | "system";

export type NotificationEvent = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationEventType;
  title: string;
  body: string;
  source_type: string | null;
  source_id: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationCountResult = {
  count: number;
  errors: string[];
};

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationCountResult> {
  const [eventsResult, connectionsResult, proposalsResult] = await Promise.all([
    supabase
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", userId)
      .eq("status", "pending"),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("status", "pending"),
  ]);

  return {
    count:
      (eventsResult.count ?? 0) + (connectionsResult.count ?? 0) + (proposalsResult.count ?? 0),
    errors: [eventsResult.error, connectionsResult.error, proposalsResult.error]
      .filter((error): error is NonNullable<typeof error> => Boolean(error))
      .map((error) => error.message),
  };
}

export async function markNotificationEventsAsRead(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("notification_events")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}
