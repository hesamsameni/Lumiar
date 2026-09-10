// ============================================================
// Model Sync — OpenRouter API types and computation helpers
//
// Used by /api/admin/sync-models to auto-detect and insert
// new models from OpenRouter's image + video APIs.
// ============================================================

// ── OpenRouter API response shapes ──────────────────────────

export interface ORImageModel {
  id: string
  name?: string
  description?: string
  pricing?: {
    image_generation?: {
      image_output?: number // USD per image (flat-fee) or per output token (very small)
    }
  }
  parameters?: {
    input_references?: { min?: number; max?: number }
    sizes?: string[]
    aspect_ratios?: string[]
  }
}

export interface ORVideoModel {
  id: string
  name?: string
  description?: string
  pricing?: {
    video_generation?: Record<string, number> // resolution key → USD per second
  }
  resolutions?: string[]
  default_resolution?: string
  durations?: { min?: number; max?: number }
  frame_images?: { first_frame?: boolean; last_frame?: boolean }
  audio?: { audio_input?: boolean; generate_audio?: boolean }
  input_references?: { min?: number; max?: number }
  aspect_ratios?: string[]
}

// ── Constants (from the add-model skill) ────────────────────

export const CREDIT_MULTIPLIER = 241 // 1 credit ≈ $0.0083 → 2× provider cost

// Tier thresholds — images (per-image USD)
const IMG_LOW = 0.06
const IMG_MID = 0.15

// Tier thresholds — videos (per-second USD at default resolution)
const VID_LOW = 0.10
const VID_MID = 0.25

// Minimum per-image price that indicates FLAT-FEE pricing.
// Values below this are per-token (too small to be per-image) and
// cannot be auto-computed — they are flagged for manual review.
const FLAT_FEE_THRESHOLD = 0.001

// Known companies that already have logos and are registered in
// modelCompanies.ts. Used to flag new/unknown companies.
export const KNOWN_COMPANIES = new Set([
  'google',
  'openai',
  'recraft',
  'black-forest-labs',
  'bytedance',
  'bytedance-seed',
  'x-ai',
  'microsoft',
  'sourceful',
  'krea',
  'qwen',
  'alibaba',
  'kuaishou',
  'minimax',
  'runway',
])

// ── Tier helpers ────────────────────────────────────────────

export function classifyImageTier(usdPerImage: number): 'low' | 'mid' | 'high' {
  if (usdPerImage < IMG_LOW) return 'low'
  if (usdPerImage < IMG_MID) return 'mid'
  return 'high'
}

export function classifyVideoTier(usdPerSec: number): 'low' | 'mid' | 'high' {
  if (usdPerSec < VID_LOW) return 'low'
  if (usdPerSec < VID_MID) return 'mid'
  return 'high'
}

// ── Formatting helpers ───────────────────────────────────────

export function formatPriceEstimate(usd: number, unit: '/image' | '/s'): string {
  if (usd >= 0.1) return `~$${usd.toFixed(2)}${unit}`
  if (usd >= 0.01) return `~$${usd.toFixed(3).replace(/0+$/, '')}${unit}`
  return `~$${usd.toFixed(4)}${unit}`
}

function companyKey(modelId: string): string {
  return modelId.split('/')[0] ?? modelId
}

function maxResFromSizes(sizes?: string[]): string | null {
  if (!sizes || sizes.length === 0) return null
  const sorted = [...sizes].sort((a, b) => {
    const pixels = (s: string) => s.split('x').reduce((acc, n) => acc * Number(n), 1)
    return pixels(b) - pixels(a)
  })
  return sorted[0]?.replace('x', '×') ?? null
}

// ── Computed result types ────────────────────────────────────

export interface SyncImageModel {
  id: string
  name: string
  description: string
  tier: 'low' | 'mid' | 'high'
  provider: 'openrouter'
  tokens_per_generation: number
  price_estimate: string
  supports_image_input: boolean
  max_image_inputs: number
  max_resolution: string | null
  quality_options: never[]
  default_quality: null
  recommended: false
  is_active: false
  sort_order: number
  // Non-DB metadata — stripped before insert
  _flags: { unknown_company: boolean; needs_pricing_review: boolean }
}

export interface SyncVideoModel {
  id: string
  name: string
  description: string
  tier: 'low' | 'mid' | 'high'
  provider: 'openrouter'
  tokens_per_generation: number
  price_estimate: string
  duration_seconds: number
  supported_durations: number[]
  resolution: string
  resolution_options: object[]
  default_resolution: string
  supports_image_input: boolean
  supports_last_frame: boolean
  supports_video_input: boolean
  supports_audio_input: boolean
  supports_audio_generation: boolean
  max_references: number
  max_reference_videos: number
  supported_aspect_ratios: string[]
  recommended: false
  is_active: false
  sort_order: number
  _flags: { unknown_company: boolean }
}

// ── Builders ─────────────────────────────────────────────────

export function buildImageModel(
  model: ORImageModel,
  nextSortOrder: number,
): SyncImageModel {
  const rawPrice = model.pricing?.image_generation?.image_output ?? 0
  const isFlatFee = rawPrice >= FLAT_FEE_THRESHOLD
  const usdPerImage = isFlatFee ? rawPrice : 0

  const maxInputs = model.parameters?.input_references?.max ?? 1

  return {
    id: model.id,
    name: model.name ?? model.id,
    description: model.description ?? '',
    tier: usdPerImage > 0 ? classifyImageTier(usdPerImage) : 'mid',
    provider: 'openrouter',
    tokens_per_generation: usdPerImage > 0
      ? Math.round(usdPerImage * CREDIT_MULTIPLIER)
      : 5,
    price_estimate: usdPerImage > 0
      ? formatPriceEstimate(usdPerImage, '/image')
      : '~$?/image',
    supports_image_input: maxInputs > 0,
    max_image_inputs: maxInputs,
    max_resolution: maxResFromSizes(model.parameters?.sizes),
    quality_options: [],
    default_quality: null,
    recommended: false,
    is_active: false,
    sort_order: nextSortOrder,
    _flags: {
      unknown_company: !KNOWN_COMPANIES.has(companyKey(model.id)),
      needs_pricing_review: !isFlatFee,
    },
  }
}

export function buildVideoModel(
  model: ORVideoModel,
  nextSortOrder: number,
): SyncVideoModel {
  const pricing = model.pricing?.video_generation ?? {}
  const resolutions = model.resolutions?.length
    ? model.resolutions
    : Object.keys(pricing)

  // Pick default resolution: prefer 720p, else middle of list
  const defaultRes =
    model.default_resolution ??
    (resolutions.includes('720p') ? '720p' : resolutions[Math.floor(resolutions.length / 2)]) ??
    '720p'

  const defaultPricePerSec = pricing[defaultRes] ?? Object.values(pricing)[0] ?? 0
  const defaultDuration = 5

  // Duration range → array (cap at 30s)
  const durMin = model.durations?.min ?? defaultDuration
  const durMax = Math.min(model.durations?.max ?? defaultDuration, 30)
  const supported_durations = Array.from(
    { length: durMax - durMin + 1 },
    (_, i) => durMin + i,
  )

  // Resolution options with relative multipliers
  const resolution_options = resolutions
    .filter(r => pricing[r] != null)
    .sort((a, b) => (pricing[a] ?? 0) - (pricing[b] ?? 0))
    .map(r => {
      const mult =
        defaultPricePerSec > 0
          ? Math.round((pricing[r]! / defaultPricePerSec) * 100) / 100
          : 1
      const isDefault = r === defaultRes
      const isCheaper = (pricing[r] ?? 0) < defaultPricePerSec
      return {
        value: r,
        label: isDefault
          ? `${r} · Standard`
          : isCheaper
            ? `${r} · Fast`
            : `${r} · High`,
        hint: isDefault
          ? 'Best for social clips'
          : isCheaper
            ? 'Best for cheap drafts & quick previews'
            : 'Best for crisp, detailed final videos',
        multiplier: mult,
      }
    })

  const refMax = model.input_references?.max ?? 0

  return {
    id: model.id,
    name: model.name ?? model.id,
    description: model.description ?? '',
    tier: classifyVideoTier(defaultPricePerSec),
    provider: 'openrouter',
    tokens_per_generation: Math.round(defaultPricePerSec * defaultDuration * CREDIT_MULTIPLIER),
    price_estimate: formatPriceEstimate(defaultPricePerSec, '/s'),
    duration_seconds: defaultDuration,
    supported_durations,
    resolution: defaultRes,
    resolution_options,
    default_resolution: defaultRes,
    supports_image_input: model.frame_images?.first_frame ?? false,
    supports_last_frame: model.frame_images?.last_frame ?? false,
    supports_video_input: false, // conservative — enable manually after verifying
    supports_audio_input: model.audio?.audio_input ?? false,
    supports_audio_generation: model.audio?.generate_audio ?? false,
    max_references: refMax,
    max_reference_videos: 0,
    supported_aspect_ratios: model.aspect_ratios ?? ['16:9', '9:16', '1:1'],
    recommended: false,
    is_active: false,
    sort_order: nextSortOrder,
    _flags: {
      unknown_company: !KNOWN_COMPANIES.has(companyKey(model.id)),
    },
  }
}
