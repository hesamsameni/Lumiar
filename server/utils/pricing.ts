/**
 * Server-authoritative credit pricing.
 *
 * The number of credits a purchase grants MUST be derived here, never taken
 * from the client — otherwise a caller could pay €2 and ask for millions of
 * credits. Keep the pack list in sync with the display packs in
 * `app/pages/credits.vue`.
 */

export interface CreditPack {
  id: string;
  euros: number;
  credits: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", euros: 2, credits: 200 },
  { id: "basic", euros: 5, credits: 550 },
  { id: "popular", euros: 10, credits: 1200 },
  { id: "pro", euros: 25, credits: 3250 },
];

export const MIN_EUROS = 2;
export const MAX_EUROS = 10_000;
export const CREDITS_PER_EURO = 100;

/**
 * Resolves a purchase request into the exact amount to charge (in cents) and
 * the number of credits to grant. A known `packId` wins and its amounts are
 * used verbatim; otherwise the request is treated as a custom top-up priced at
 * a flat {@link CREDITS_PER_EURO} credits per euro. Throws a 400 on invalid
 * input.
 */
export function resolvePurchase(input: {
  packId?: string | null;
  amountEuros?: number | null;
}): { amountCents: number; tokens: number } {
  if (input.packId) {
    const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
    if (!pack) {
      throw createError({ statusCode: 400, message: "Unknown credit pack" });
    }
    return {
      amountCents: Math.round(pack.euros * 100),
      tokens: pack.credits,
    };
  }

  const euros = Number(input.amountEuros);
  if (!Number.isFinite(euros) || euros < MIN_EUROS) {
    throw createError({
      statusCode: 400,
      message: `Minimum amount is €${MIN_EUROS}`,
    });
  }
  if (euros > MAX_EUROS) {
    throw createError({
      statusCode: 400,
      message: `Maximum amount is €${MAX_EUROS}`,
    });
  }

  return {
    amountCents: Math.round(euros * 100),
    tokens: Math.floor(euros * CREDITS_PER_EURO),
  };
}
