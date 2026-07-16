// Shared model for user-selectable quality (images) / resolution (video) tiers.
//
// Each model carries an ordered list of options plus a default. The UI shows a
// picker (labelled "Quality" for images, "Resolution" for video) with an "Auto"
// entry that maps to the model's default. Credit cost scales by the selected
// option's multiplier. Cost is always recomputed server-side from the DB — the
// helpers here drive the live estimate + balance pre-check on the client.

export interface QualityOption {
  // Selectable key. For video this is also the OpenRouter `resolution` value.
  value: string;
  // Shown in the picker, e.g. "Standard (2K)" or "1080p · High".
  label: string;
  // Optional "best for X" use-case shown under the label in the picker.
  hint?: string;
  // Provider-native value (OpenAI `quality`, Gemini `imageSize`). Defaults to `value`.
  param?: string;
  // Credit cost = tokens_per_generation * multiplier (combined with duration for video).
  multiplier: number;
}

// Sentinel selectable value meaning "use the model's default tier".
export const AUTO_QUALITY = "auto";

// Resolve the requested selection to a concrete option. Returns null when the
// model exposes no options (i.e. no quality/resolution control).
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

// Credit cost for a given selection. `extraFactor` lets video fold in duration.
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
  // Models with real options always cost at least 1 credit; a zero-cost model
  // (e.g. a free tier) stays at 0 when it has no options.
  return opt ? Math.max(1, cost) : Math.max(0, cost);
}

export interface QualityPickerItem {
  value: string;
  label: string;
  hint: string;
  credits: number;
  recommended: boolean;
}

// Build the picker rows: an "Auto" row (mapped to the default) followed by each
// concrete tier. Returns [] when the model has no options, so callers can hide
// the control entirely.
export function buildQualityPicker(
  tokensPerGeneration: number,
  options: QualityOption[] | null | undefined,
  defaultValue: string | null | undefined,
  extraFactor = 1,
): QualityPickerItem[] {
  const opts = Array.isArray(options) ? options : [];
  if (opts.length === 0) return [];
  const def = resolveQualityOption(opts, defaultValue, AUTO_QUALITY);
  const auto: QualityPickerItem = {
    value: AUTO_QUALITY,
    label: "Auto",
    hint: def ? `Recommended · ${def.label}` : "Recommended",
    credits: creditsForOption(tokensPerGeneration, opts, defaultValue, AUTO_QUALITY, extraFactor),
    recommended: true,
  };
  const rest = opts.map((o) => ({
    value: o.value,
    label: o.label,
    hint: o.hint ?? "",
    credits: creditsForOption(tokensPerGeneration, opts, defaultValue, o.value, extraFactor),
    recommended: false,
  }));
  return [auto, ...rest];
}

// Label shown on the compact summary-strip pill for the current selection.
export function currentOptionLabel(
  options: QualityOption[] | null | undefined,
  defaultValue: string | null | undefined,
  requested: string | null | undefined,
): string {
  if (!requested || requested === AUTO_QUALITY) return "Auto";
  const opt = resolveQualityOption(options, defaultValue, requested);
  return opt?.label ?? "Auto";
}
