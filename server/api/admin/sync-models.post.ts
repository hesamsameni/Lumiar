// ============================================================
// POST /api/admin/sync-models
//
// Detects and inserts new models from the OpenRouter images +
// videos APIs. All new models land with is_active = false so
// they never appear in the picker until an admin enables them.
//
// Authentication — one of:
//   1. Admin session:  Authorization: Bearer <user-access-token>
//   2. Cron secret:    Authorization: Bearer <MODEL_SYNC_SECRET>
//
// Returns a summary of what was added / skipped.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import {
  buildImageModel,
  buildVideoModel,
  type ORImageModel,
  type ORVideoModel,
  type SyncImageModel,
  type SyncVideoModel,
} from '../../utils/model-sync'
import { sendAdminEmail, buildSyncEmailHtml } from '../../utils/email'

const OR_BASE = 'https://openrouter.ai/api/v1'

interface ORModelsResponse<T> {
  data?: T[]
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // ── Auth: accept admin session OR cron secret ──────────────
  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  const syncSecret = config.modelSyncSecret as string | undefined
  const isCronCall = syncSecret && token === syncSecret

  if (!isCronCall) {
    // Fall back to admin session check
    const supabaseUrl = config.supabaseUrl as string
    const supabaseAnonKey = config.public.supabaseAnonKey as string
    const sessionClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    const { data: profile } = await sessionClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single() as { data: { is_admin: boolean } | null }

    if (!profile?.is_admin) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  }

  // ── Service-role client (bypasses RLS for reads + inserts) ──
  const supabase = createClient(
    config.supabaseUrl as string,
    config.supabaseServiceRoleKey as string,
  )

  // ── 1. Fetch OpenRouter model lists ──────────────────────────
  let orImages: ORImageModel[] = []
  let orVideos: ORVideoModel[] = []

  try {
    const [imgRes, vidRes] = await Promise.all([
      $fetch<ORModelsResponse<ORImageModel>>(`${OR_BASE}/images/models`, {
        headers: { Authorization: `Bearer ${config.openrouterApiKey}` },
      }),
      $fetch<ORModelsResponse<ORVideoModel>>(`${OR_BASE}/videos/models`, {
        headers: { Authorization: `Bearer ${config.openrouterApiKey}` },
      }),
    ])
    orImages = imgRes?.data ?? []
    orVideos = vidRes?.data ?? []
  } catch (err) {
    throw createError({
      statusCode: 502,
      message: `Failed to fetch OpenRouter model lists: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  // ── 2. Load existing model IDs from DB ───────────────────────
  const [{ data: existingImg }, { data: existingVid }] = await Promise.all([
    supabase.from('ai_models').select('id'),
    supabase.from('video_models').select('id'),
  ])

  const existingImageIds = new Set((existingImg ?? []).map((r: { id: string }) => r.id))
  const existingVideoIds = new Set((existingVid ?? []).map((r: { id: string }) => r.id))

  // ── 3. Diff: find models not yet in DB ───────────────────────
  const newOrImages = orImages.filter(m => m.id && !existingImageIds.has(m.id))
  const newOrVideos = orVideos.filter(m => m.id && !existingVideoIds.has(m.id))

  if (newOrImages.length === 0 && newOrVideos.length === 0) {
    return { added_image: 0, added_video: 0, skipped_image: 0, message: 'No new models found.' }
  }

  // ── 4. Get current max sort_orders ──────────────────────────
  const [{ data: maxImgRow }, { data: maxVidRow }] = await Promise.all([
    supabase.from('ai_models').select('sort_order').order('sort_order', { ascending: false }).limit(1),
    supabase.from('video_models').select('sort_order').order('sort_order', { ascending: false }).limit(1),
  ])

  let imgSortBase: number = ((maxImgRow as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1
  let vidSortBase: number = ((maxVidRow as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1

  // ── 5. Compute new model rows ────────────────────────────────
  const addedImageModels: SyncImageModel[] = []
  const skippedImageModels: SyncImageModel[] = []

  for (const m of newOrImages) {
    const built = buildImageModel(m, imgSortBase)
    if (built._flags.needs_pricing_review) {
      skippedImageModels.push(built)
    } else {
      addedImageModels.push(built)
      imgSortBase++
    }
  }

  const addedVideoModels: SyncVideoModel[] = []
  for (const m of newOrVideos) {
    addedVideoModels.push(buildVideoModel(m, vidSortBase))
    vidSortBase++
  }

  // ── 6. Insert into DB ────────────────────────────────────────
  // Strip internal _flags before inserting
  const stripFlags = <T extends { _flags: unknown }>(m: T): Omit<T, '_flags'> => {
    const { _flags: _ignored, ...rest } = m
    return rest
  }

  const insertErrors: string[] = []

  if (addedImageModels.length > 0) {
    const { error } = await supabase
      .from('ai_models')
      .insert(addedImageModels.map(stripFlags) as never)
    if (error) insertErrors.push(`ai_models: ${error.message}`)
  }

  if (addedVideoModels.length > 0) {
    const { error } = await supabase
      .from('video_models')
      .insert(addedVideoModels.map(stripFlags) as never)
    if (error) insertErrors.push(`video_models: ${error.message}`)
  }

  if (insertErrors.length > 0) {
    throw createError({ statusCode: 500, message: insertErrors.join('; ') })
  }

  // ── 7. Send admin email ──────────────────────────────────────
  const totalAdded = addedImageModels.length + addedVideoModels.length

  if (totalAdded > 0 || skippedImageModels.length > 0) {
    const toEmailModel = (m: SyncImageModel | SyncVideoModel) => {
      const flags: string[] = []
      if (m._flags.unknown_company) flags.push('unknown company — needs logo')
      if ('needs_pricing_review' in m._flags && m._flags.needs_pricing_review) {
        flags.push('token-based pricing — skipped')
      }
      return {
        id: m.id,
        name: m.name,
        tier: m.tier,
        tokens_per_generation: m.tokens_per_generation,
        price_estimate: m.price_estimate,
        flags,
      }
    }

    const html = buildSyncEmailHtml({
      imageModels: addedImageModels.map(toEmailModel),
      videoModels: addedVideoModels.map(toEmailModel),
      skippedImage: skippedImageModels.map(toEmailModel),
      siteUrl: config.public.siteUrl as string,
    })

    if (html) {
      await sendAdminEmail(
        config.resendApiKey as string,
        config.adminEmail as string,
        `Lumiar: ${totalAdded} new model${totalAdded === 1 ? '' : 's'} detected`,
        html,
      )
    }
  }

  // ── 8. Return summary ────────────────────────────────────────
  return {
    added_image: addedImageModels.length,
    added_video: addedVideoModels.length,
    skipped_image: skippedImageModels.length,
    skipped_image_ids: skippedImageModels.map(m => m.id),
    unknown_companies: [
      ...addedImageModels.filter(m => m._flags.unknown_company).map(m => m.id),
      ...addedVideoModels.filter(m => m._flags.unknown_company).map(m => m.id),
    ],
    message: totalAdded > 0
      ? `Added ${addedImageModels.length} image and ${addedVideoModels.length} video model(s). Email sent.`
      : 'No auto-priceable models found. Check skipped_image_ids for token-based models.',
  }
})
