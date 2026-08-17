import { serverSupabaseClient } from "#supabase/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "../utils/auth";

interface UsageRow {
  model_id: string;
  model_name: string;
  type: "image" | "video";
  count: number;
  total_credits: number;
  total_provider_cost: number | null;
  first_used: string;
  last_used: string;
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const supabase = await serverSupabaseClient(event);

  // Check if the requesting user is admin or partner.
  const { data: profileRow } = (await (supabase as any)
    .from("profiles")
    .select("is_admin, is_partner")
    .eq("id", user.id)
    .single()) as { data: { is_admin: boolean; is_partner: boolean } | null };
  const isAdmin = !!profileRow?.is_admin;
  const isPartner = !!profileRow?.is_partner;
  const canSeeProviderCost = isAdmin || isPartner;

  // Admin can view another user's usage via ?userId=
  const query = getQuery(event);
  const requestedUserId =
    typeof query.userId === "string" ? query.userId : null;
  if (requestedUserId && !isAdmin) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }
  const targetUserId = requestedUserId || user.id;

  // When admin, use service-role client to bypass RLS.
  let db: any = supabase;
  if (isAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      (useRuntimeConfig().supabaseServiceRoleKey as string | undefined);
    if (supabaseUrl && serviceRoleKey) {
      db = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
    }
  }

  // If admin, fetch the list of users who have at least one generation.
  let users: { id: string; username: string | null; email: string | null }[] =
    [];
  if (isAdmin) {
    const { data: allProfiles } = (await db
      .from("profiles")
      .select("id, username")
      .order("username", { ascending: true })) as {
      data: { id: string; username: string | null }[] | null;
    };
    users = (allProfiles ?? []).map((p: any) => ({
      id: p.id,
      username: p.username,
      email: null,
    }));
  }

  // Aggregate image generations by model.
  const { data: imageRows } = (await db
    .from("generations")
    .select("model_id, model_name, tokens_used, provider_cost, created_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: true })) as {
    data:
      | {
          model_id: string;
          model_name: string;
          tokens_used: number;
          provider_cost: number | null;
          created_at: string;
        }[]
      | null;
  };

  // Aggregate video generations by model (only completed ones).
  const { data: videoRows } = (await db
    .from("video_generations")
    .select(
      "model_id, model_name, tokens_used, provider_cost, created_at, status",
    )
    .eq("user_id", targetUserId)
    .neq("status", "failed")
    .order("created_at", { ascending: true })) as {
    data:
      | {
          model_id: string;
          model_name: string;
          tokens_used: number;
          provider_cost: number | null;
          created_at: string;
          status: string;
        }[]
      | null;
  };

  // Group by model_id + type.
  const groups = new Map<string, UsageRow>();

  for (const row of imageRows ?? []) {
    const key = `image:${row.model_id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.total_credits += row.tokens_used;
      if (row.provider_cost != null) {
        existing.total_provider_cost =
          (existing.total_provider_cost ?? 0) + row.provider_cost;
      }
      existing.last_used = row.created_at;
    } else {
      groups.set(key, {
        model_id: row.model_id,
        model_name: row.model_name,
        type: "image",
        count: 1,
        total_credits: row.tokens_used,
        total_provider_cost: row.provider_cost,
        first_used: row.created_at,
        last_used: row.created_at,
      });
    }
  }

  for (const row of videoRows ?? []) {
    const key = `video:${row.model_id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.total_credits += row.tokens_used;
      if (row.provider_cost != null) {
        existing.total_provider_cost =
          (existing.total_provider_cost ?? 0) + row.provider_cost;
      }
      existing.last_used = row.created_at;
    } else {
      groups.set(key, {
        model_id: row.model_id,
        model_name: row.model_name,
        type: "video",
        count: 1,
        total_credits: row.tokens_used,
        total_provider_cost: row.provider_cost,
        first_used: row.created_at,
        last_used: row.created_at,
      });
    }
  }

  // Sort by total credits descending.
  const models = [...groups.values()].sort(
    (a, b) => b.total_credits - a.total_credits,
  );

  // Totals.
  const totalCredits = models.reduce((s, m) => s + m.total_credits, 0);
  const totalImages = models
    .filter((m) => m.type === "image")
    .reduce((s, m) => s + m.count, 0);
  const totalVideos = models
    .filter((m) => m.type === "video")
    .reduce((s, m) => s + m.count, 0);
  const totalProviderCost = canSeeProviderCost
    ? models.reduce((s, m) => s + (m.total_provider_cost ?? 0), 0)
    : null;

  return {
    models: canSeeProviderCost
      ? models
      : models.map(({ total_provider_cost: _, ...rest }) => rest),
    totalCredits,
    totalImages,
    totalVideos,
    totalProviderCost,
    isAdmin,
    canSeeProviderCost,
    users,
    targetUserId,
  };
});
