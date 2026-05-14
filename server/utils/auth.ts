import { serverSupabaseClient } from "#supabase/server";
import type { H3Event } from "h3";

/**
 * Verifies the request is authenticated.
 * Reads the Bearer token from the Authorization header and validates
 * it against Supabase. API routes called from the browser must include
 * `Authorization: Bearer <access_token>` in their request headers.
 * Throws 401 if the token is missing or invalid.
 */
export async function requireUser(event: H3Event) {
  const authHeader = getHeader(event, "authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const client = await serverSupabaseClient(event);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user?.id) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  return data.user;
}
