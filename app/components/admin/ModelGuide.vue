<script setup lang="ts">
const props = defineProps<{
  kind: "image" | "video";
}>();

const open = ref(false);

const isImage = computed(() => props.kind === "image");

const title = computed(() =>
  isImage.value
    ? "How to add an image model"
    : "How to add a video model",
);

const subtitle = computed(() =>
  isImage.value
    ? "What to copy from OpenRouter, OpenAI, or Google before filling the form"
    : "What to copy from OpenRouter’s video models API before filling the form",
);
</script>

<template>
  <div
    class="mb-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 overflow-hidden"
  >
    <button
      type="button"
      class="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40 transition-colors"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span
        class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 flex-shrink-0"
      >
        <UIcon name="i-lucide-book-open" class="size-4" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold tracking-tight">{{ title }}</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
          {{ subtitle }}
        </p>
      </div>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 text-zinc-400 flex-shrink-0 transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <div v-if="open" class="border-t border-zinc-200 dark:border-zinc-800">
      <div class="px-4 sm:px-5 py-5 space-y-6 text-sm">
        <!-- Discovery -->
        <section>
          <h3
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            <UIcon name="i-lucide-search" class="size-3.5" />
            1. Find the model
          </h3>

          <template v-if="isImage">
            <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3">
              Prefer
              <a
                href="https://openrouter.ai/models?output_modalities=image"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
                >OpenRouter image models</a
              >
              unless you’re wiring OpenAI or Google directly.
            </p>
            <div
              class="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 font-mono text-[12px] text-zinc-700 dark:text-zinc-300 overflow-x-auto"
            >
              curl "https://openrouter.ai/api/v1/models?output_modalities=image"
            </div>
            <ul
              class="mt-3 space-y-1.5 text-zinc-600 dark:text-zinc-400 text-[13px]"
            >
              <li class="flex gap-2">
                <span class="text-primary">·</span>
                Copy the exact <strong class="text-zinc-800 dark:text-zinc-200">id</strong> slug
              </li>
              <li class="flex gap-2">
                <span class="text-primary">·</span>
                Note pricing (per image / megapixel)
              </li>
              <li class="flex gap-2">
                <span class="text-primary">·</span>
                Check supported sizes / quality knobs and whether it accepts input images
              </li>
            </ul>
          </template>

          <template v-else>
            <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3">
              All video models are served via OpenRouter. Use the dedicated video
              catalog:
            </p>
            <div
              class="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 font-mono text-[12px] text-zinc-700 dark:text-zinc-300 overflow-x-auto"
            >
              curl "https://openrouter.ai/api/v1/videos/models"
            </div>
            <p class="mt-3 text-[13px] text-zinc-600 dark:text-zinc-400">
              For each model, note
              <code class="text-xs px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800"
                >id</code
              >,
              <code class="text-xs px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800"
                >supported_durations</code
              >,
              <code class="text-xs px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800"
                >supported_resolutions</code
              >,
              <code class="text-xs px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800"
                >supported_aspect_ratios</code
              >,
              <code class="text-xs px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800"
                >supported_frame_images</code
              >, and
              <code class="text-xs px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800"
                >pricing_skus</code
              >.
            </p>
          </template>
        </section>

        <!-- Credits -->
        <section>
          <h3
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            <UIcon name="i-lucide-calculator" class="size-3.5" />
            2. Calculate credits (~2× provider cost)
          </h3>
          <div
            class="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2"
          >
            <p class="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
              credits ≈ round(usd_cost × 241)
            </p>
            <p
              v-if="isImage"
              class="font-mono text-[12px] text-zinc-700 dark:text-zinc-300"
            >
              image = round(tokens_per_generation × quality_multiplier)
            </p>
            <p
              v-else
              class="font-mono text-[12px] text-zinc-700 dark:text-zinc-300"
            >
              video = round(tokens × seconds × res_multiplier / default_seconds)
            </p>
            <p class="text-[12px] text-zinc-500 dark:text-zinc-400 pt-1">
              <template v-if="isImage">
                <strong class="text-zinc-700 dark:text-zinc-300"
                  >Tokens / Generation</strong
                >
                = cost of the default quality tier (multiplier 1).
              </template>
              <template v-else>
                <strong class="text-zinc-700 dark:text-zinc-300"
                  >Credits / Generation</strong
                >
                = cost at the default duration
                <em>and</em> default resolution. Resolution multipliers are
                relative to that default (e.g. $0.08 / $0.14 / $0.25 → 0.57 / 1 /
                1.8).
              </template>
            </p>
          </div>
        </section>

        <!-- Field map -->
        <section>
          <h3
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            <UIcon name="i-lucide-table-2" class="size-3.5" />
            3. Map fields
          </h3>

          <div
            class="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950"
          >
            <div class="overflow-x-auto">
              <table class="w-full text-[13px]">
                <thead>
                  <tr
                    class="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    <th class="px-3 py-2.5 font-medium">Admin field</th>
                    <th class="px-3 py-2.5 font-medium">Where to get it</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  <template v-if="isImage">
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Model ID
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        Exact slug. Immutable after create.
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Provider
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        <code class="text-xs">openai</code> /
                        <code class="text-xs">google</code> for direct APIs;
                        otherwise <code class="text-xs">openrouter</code>
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Tokens / Generation
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        <code class="text-xs">round(usd × 241)</code> for the
                        default quality tier
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Quality tiers
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        Provider knobs. Set
                        <strong>param</strong> to the API value (OpenAI:
                        <code class="text-xs">medium/high</code>; Google/OR:
                        <code class="text-xs">1K/2K/4K</code>)
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Image input
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        On if the model supports edit / reference images; set max
                        refs from docs
                      </td>
                    </tr>
                  </template>
                  <template v-else>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Model ID
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        OpenRouter <code class="text-xs">id</code> (e.g.
                        <code class="text-xs">x-ai/grok-imagine-video-1.5</code>).
                        Maker prefix groups the UI by brand.
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Durations
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        <code class="text-xs">supported_durations</code> →
                        selectable list; pick a Default (s) from that list
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Resolution tiers
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        <code class="text-xs">supported_resolutions</code> as
                        <strong>value</strong>; multipliers from
                        <code class="text-xs">pricing_skus</code> vs default
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Aspect ratios
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        Toggle only those in
                        <code class="text-xs">supported_aspect_ratios</code>
                      </td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 font-medium whitespace-nowrap">
                        Image / last frame
                      </td>
                      <td class="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        <code class="text-xs">first_frame</code> → image input;
                        <code class="text-xs">last_frame</code> → last frame.
                        Leave off if not listed.
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Provider note (image) / gotchas -->
        <section v-if="isImage">
          <h3
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            <UIcon name="i-lucide-route" class="size-3.5" />
            Provider routing
          </h3>
          <div class="grid sm:grid-cols-3 gap-2">
            <div
              class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3"
            >
              <p class="font-medium text-[13px] mb-1">openai</p>
              <p class="text-[12px] text-zinc-500 dark:text-zinc-400">
                Direct OpenAI. ID like
                <code class="text-[11px]">openai/gpt-image-2</code> — prefix is
                stripped.
              </p>
            </div>
            <div
              class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3"
            >
              <p class="font-medium text-[13px] mb-1">google</p>
              <p class="text-[12px] text-zinc-500 dark:text-zinc-400">
                Direct Google. ID like
                <code class="text-[11px]">google/gemini-…</code> — prefix is
                stripped.
              </p>
            </div>
            <div
              class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3"
            >
              <p class="font-medium text-[13px] mb-1">openrouter</p>
              <p class="text-[12px] text-zinc-500 dark:text-zinc-400">
                Everything else. Full ID is sent as-is (Flux, Grok, Recraft…).
              </p>
            </div>
          </div>
          <p class="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
            ID prefix is for brand grouping — it is not the same as Provider.
          </p>
        </section>

        <!-- Checklist -->
        <section>
          <h3
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            <UIcon name="i-lucide-list-checks" class="size-3.5" />
            4. Before you save
          </h3>
          <ul class="space-y-2">
            <template v-if="isImage">
              <li
                v-for="item in [
                  'Model ID is exact and Provider is correct',
                  'Tokens match the default quality tier (multiplier 1)',
                  'Quality param matches provider knobs (medium/high or 1K/2K/4K)',
                  'Image input + max refs match the docs',
                  'Active is on, then smoke-test a cheap generation',
                ]"
                :key="item"
                class="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-400"
              >
                <UIcon
                  name="i-lucide-square-check"
                  class="size-3.5 text-primary mt-0.5 flex-shrink-0"
                />
                {{ item }}
              </li>
            </template>
            <template v-else>
              <li
                v-for="item in [
                  'Model ID matches OpenRouter exactly',
                  'Durations / resolutions only include supported values',
                  'Credits = default duration × default resolution cost',
                  'Last frame enabled only if API lists last_frame',
                  'Active is on, then smoke-test a short / low-res clip',
                ]"
                :key="item"
                class="flex items-start gap-2 text-[13px] text-zinc-600 dark:text-zinc-400"
              >
                <UIcon
                  name="i-lucide-square-check"
                  class="size-3.5 text-primary mt-0.5 flex-shrink-0"
                />
                {{ item }}
              </li>
            </template>
          </ul>
        </section>

        <!-- Example -->
        <section>
          <h3
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3"
          >
            <UIcon name="i-lucide-sparkles" class="size-3.5" />
            Example
          </h3>
          <div
            class="rounded-xl border border-primary/20 bg-gradient-to-br from-indigo-500/8 via-violet-500/6 to-fuchsia-500/8 p-3.5"
          >
            <template v-if="isImage">
              <p class="font-medium text-[13px] mb-2">
                openai/gpt-image-2
              </p>
              <dl
                class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]"
              >
                <div class="flex justify-between gap-2 sm:block">
                  <dt class="text-zinc-500">Provider</dt>
                  <dd class="font-mono">openai</dd>
                </div>
                <div class="flex justify-between gap-2 sm:block">
                  <dt class="text-zinc-500">Tokens / Generation</dt>
                  <dd class="font-mono">10</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-zinc-500 mb-0.5">Quality</dt>
                  <dd class="font-mono text-zinc-700 dark:text-zinc-300">
                    standard → param medium ×1 · high → param high ×4
                  </dd>
                </div>
              </dl>
            </template>
            <template v-else>
              <p class="font-medium text-[13px] mb-2">
                x-ai/grok-imagine-video-1.5
              </p>
              <dl
                class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]"
              >
                <div class="flex justify-between gap-2 sm:block">
                  <dt class="text-zinc-500">Credits @ 5s / 720p</dt>
                  <dd class="font-mono">170</dd>
                </div>
                <div class="flex justify-between gap-2 sm:block">
                  <dt class="text-zinc-500">Durations</dt>
                  <dd class="font-mono">1–15s</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-zinc-500 mb-0.5">Resolutions</dt>
                  <dd class="font-mono text-zinc-700 dark:text-zinc-300">
                    480p ×0.57 · 720p ×1 · 1080p ×1.8
                  </dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-zinc-500 mb-0.5">Frames</dt>
                  <dd class="text-zinc-700 dark:text-zinc-300">
                    Image input on · Last frame off
                  </dd>
                </div>
              </dl>
            </template>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
