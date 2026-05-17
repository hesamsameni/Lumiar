import Stripe from "stripe";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const config = useRuntimeConfig();

  const { amountEuros } = await readBody<{ amountEuros: number }>(event);

  if (!amountEuros || amountEuros < 2) {
    throw createError({ statusCode: 400, message: "Minimum amount is €2" });
  }

  const tokens = Math.floor(amountEuros * 100);
  const amountCents = Math.round(amountEuros * 100);

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
              name: `${tokens.toLocaleString()} Lumiar Tokens`,
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
