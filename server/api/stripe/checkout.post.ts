import Stripe from "stripe";
import { requireUser } from "../../utils/auth";
import { resolvePurchase } from "../../utils/pricing";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();

  const body = await readBody<{ packId?: string; amountEuros?: number }>(event);

  // The credit amount is resolved server-side from a trusted price table.
  // Never trust a client-supplied credit/token count — otherwise a caller
  // could pay the minimum and grant themselves unlimited credits.
  const { amountCents, tokens } = resolvePurchase({
    packId: body?.packId ?? null,
    amountEuros: body?.amountEuros ?? null,
  });

  if (!config.stripeSecretKey) {
    throw createError({ statusCode: 500, message: "Stripe is not configured" });
  }

  const stripe = new Stripe(config.stripeSecretKey as string);
  const origin = getRequestURL(event).origin;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${tokens.toLocaleString()} Lumiar Credits`,
              description: "AI image generation credits — no expiry",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/credits?success=true`,
      cancel_url: `${origin}/credits?canceled=true`,
      metadata: {
        userId: user.id,
        tokens: String(tokens),
      },
    });
  } catch (err: unknown) {
    const stripeErr = err as { message?: string; statusCode?: number };
    throw createError({
      statusCode: stripeErr.statusCode ?? 500,
      message: stripeErr.message ?? "Stripe error",
    });
  }

  return { url: session.url };
});
