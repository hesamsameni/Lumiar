import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const stripe = new Stripe(config.stripeSecretKey as string);

  const rawBody = await readRawBody(event);
  const sig = getHeader(event, "stripe-signature");

  if (!rawBody || !sig) {
    throw createError({ statusCode: 400, message: "Bad request" });
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      config.stripeWebhookSecret as string,
    );
  } catch {
    throw createError({ statusCode: 400, message: "Invalid Stripe signature" });
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return { ok: true };
    }

    const userId = session.metadata?.userId;
    const tokens = parseInt(session.metadata?.tokens ?? "0", 10);
    const sessionId = session.id;

    if (!userId || !tokens) {
      throw createError({
        statusCode: 400,
        message: "Missing session metadata",
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      (config.supabaseServiceRoleKey as string | undefined);

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "[webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      );
      throw createError({
        statusCode: 500,
        message: "Server misconfiguration",
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Idempotency: skip if this session was already processed
    const { data: existing } = await supabase
      .from("token_transactions")
      .select("id")
      .eq("description", `stripe:${sessionId}`)
      .maybeSingle();

    if (existing) {
      return { ok: true };
    }

    // Log the transaction
    const { error: txError } = await supabase
      .from("token_transactions")
      .insert({
        user_id: userId,
        amount: tokens,
        type: "purchase",
        description: `stripe:${sessionId}`,
      });

    if (txError) {
      console.error("[webhook] Failed to log transaction:", txError);
      throw createError({
        statusCode: 500,
        message: "Failed to log transaction",
      });
    }

    // Atomically increment the token balance
    const { error: rpcError } = await supabase.rpc("add_tokens_to_user", {
      p_user_id: userId,
      p_amount: tokens,
    });

    if (rpcError) {
      console.error("[webhook] Failed to update token balance:", rpcError);
      throw createError({
        statusCode: 500,
        message: "Failed to update token balance",
      });
    }

    console.info(`[webhook] Added ${tokens} tokens to user ${userId}`);
  }

  return { ok: true };
});
