import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client authenticated with the service-role key, which
 * bypasses RLS. Use only in trusted server code (public read endpoints that
 * must see data regardless of the caller's session). Returns null when the
 * required env is missing so callers can degrade gracefully.
 */
export function getServiceRoleClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (useRuntimeConfig().supabaseServiceRoleKey as string | undefined);

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
