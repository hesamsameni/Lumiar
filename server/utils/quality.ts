// Server-side quality/resolution pricing (mirror of app/utils/quality.ts).
// Kept standalone because server code doesn't share the app `~` alias.

export interface QualityOption {
  value: string;
  label: string;
  hint?: string;
  param?: string;
  multiplier: number;
}

export const AUTO_QUALITY = "auto";

export function resolveQualityOption(
  options: QualityOption[] | null | undefined,
  defaultValue: string | null | undefined,
  requested: string | null | undefined,
): QualityOption | null {
  const opts = Array.isArray(options) ? options : [];
  if (opts.length === 0) return null;
  const fallback = opts.find((o) => o.value === defaultValue) ?? opts[0]!;
  if (!requested || requested === AUTO_QUALITY) return fallback;
  return opts.find((o) => o.value === requested) ?? fallback;
}

export function creditsForOption(
  tokensPerGeneration: number,
  options: QualityOption[] | null | undefined,
  defaultValue: string | null | undefined,
  requested: string | null | undefined,
  extraFactor = 1,
): number {
  const base = Math.max(0, tokensPerGeneration || 0);
  const opt = resolveQualityOption(options, defaultValue, requested);
  const multiplier = opt?.multiplier ?? 1;
  const cost = Math.round(base * multiplier * extraFactor);
  return opt ? Math.max(1, cost) : Math.max(0, cost);
}
