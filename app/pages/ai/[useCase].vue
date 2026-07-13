<script setup lang="ts">
import { USE_CASES, USE_CASE_STEPS, getUseCase } from "~/utils/useCases";

// Remount the page when the slug changes so setup (meta, examples, content)
// re-runs instead of reusing the previous use-case's data.
definePageMeta({ key: (route) => route.path });

const route = useRoute();
const config = useRuntimeConfig();

const slug = computed(() => route.params.useCase as string);
const useCase = computed(() => getUseCase(slug.value));

if (!useCase.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Tool not found",
    fatal: true,
  });
}

const uc = useCase.value!;

const siteUrl = (
  (config.public.siteUrl as string) || "https://www.lumiar.site"
).replace(/\/$/, "");
const canonical = `${siteUrl}/ai/${uc.slug}`;
const generateLink = `/?prompt=${encodeURIComponent(uc.heroPrompt)}`;

const otherTools = computed(() =>
  USE_CASES.filter((u) => u.slug !== uc.slug).slice(0, 4),
);

type Example = {
  id: string;
  imageUrl: string;
  caption: string;
  linkUrl: string | null;
  aspectRatio: string | null;
};

const { data: examplesData } = await useAsyncData(
  `landing-examples-${uc.slug}`,
  () =>
    $fetch<{ examples: Example[] }>("/api/landing-examples", {
      query: { slug: uc.slug, tag: uc.exampleTag, limit: 9 },
      // Bypass the browser HTTP cache so admin image edits show on
      // client-side navigation (not just on a full refresh / SSR).
      cache: "no-store",
    }),
  {
    server: true,
    default: () => ({ examples: [] as Example[] }),
    getCachedData: () => undefined,
  },
);

const examples = computed(() => examplesData.value?.examples ?? []);

// Per-page social/OG image. Priority: explicit config override → the page's
// first example image (admin-curated or community) → site-wide default.
function toAbsolute(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}
const ogImage = computed(() => {
  if (uc.ogImage) return toAbsolute(uc.ogImage);
  const firstExample = examples.value[0]?.imageUrl;
  if (firstExample) return toAbsolute(firstExample);
  return `${siteUrl}/og-image.png`;
});

useSeoMeta({
  title: uc.metaTitle,
  description: uc.metaDescription,
  ogTitle: uc.metaTitle,
  ogDescription: uc.metaDescription,
  ogUrl: canonical,
  ogType: "website",
  ogImage: () => ogImage.value,
  ogImageAlt: `${uc.heading} — Lumiar`,
  twitterCard: "summary_large_image",
  twitterTitle: uc.metaTitle,
  twitterDescription: uc.metaDescription,
  twitterImage: () => ogImage.value,
});

useHead({
  link: [{ rel: "canonical", href: canonical }],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: uc.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }),
    },
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "AI Tools",
            item: `${siteUrl}/ai`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: uc.heading,
            item: canonical,
          },
        ],
      }),
    },
  ],
});

function ratioStyle(value: string | null): string | undefined {
  if (!value || value === "auto") return undefined;
  return value.replace(":", " / ");
}
</script>

<template>
  <div class="relative isolate">
    <!-- Hero -->
    <section class="relative isolate">
      <AuroraBackdrop />
      <div class="max-w-4xl mx-auto px-4 pt-16 sm:pt-24 pb-12 text-center">
        <nav
          class="mb-6 flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500"
          aria-label="Breadcrumb"
        >
          <NuxtLink to="/ai" class="hover:text-primary transition-colors"
            >AI Tools</NuxtLink
          >
          <UIcon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-zinc-500 dark:text-zinc-400">{{ uc.label }}</span>
        </nav>

        <span
          class="inline-flex items-center gap-1.5 mb-5 rounded-full border border-zinc-200/80 dark:border-zinc-700/60 bg-white/60 dark:bg-zinc-900/50 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
        >
          <UIcon :name="`i-lucide-${uc.icon}`" class="size-3 text-primary" />
          {{ uc.badge }}
        </span>

        <h1
          class="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4"
        >
          <span class="text-gradient-brand animate-gradient-pan">{{
            uc.heading
          }}</span>
        </h1>
        <p
          class="text-base sm:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto"
        >
          {{ uc.tagline }}
        </p>

        <div
          class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <UButton
            :to="generateLink"
            size="lg"
            class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 hover:animate-gradient-pan transition-all"
          >
            <UIcon name="i-lucide-sparkles" class="size-4" />
            Try it free
          </UButton>
          <UButton to="/explore" size="lg" variant="outline" color="neutral">
            <UIcon name="i-lucide-compass" class="size-4" />
            See examples
          </UButton>
        </div>
        <p class="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          No credit card required · Free credits to start
        </p>
      </div>
    </section>

    <!-- Intro -->
    <section class="max-w-3xl mx-auto px-4 pb-4">
      <p
        class="text-base sm:text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 text-center"
      >
        {{ uc.intro }}
      </p>
    </section>

    <!-- Live examples -->
    <section v-if="examples.length" class="max-w-6xl mx-auto px-4 py-12">
      <div class="text-center mb-8">
        <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Made with Lumiar
        </h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Real creations from the community
        </p>
      </div>
      <div class="columns-2 sm:columns-3 lg:columns-4 gap-3">
        <component
          :is="ex.linkUrl ? 'NuxtLink' : 'div'"
          v-for="ex in examples"
          :key="ex.id"
          :to="ex.linkUrl || undefined"
          class="mb-3 block break-inside-avoid group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
        >
          <img
            :src="ex.imageUrl"
            :alt="ex.caption || `${uc.label} example`"
            loading="lazy"
            class="w-full transition-transform duration-300 group-hover:scale-[1.03]"
            :class="ratioStyle(ex.aspectRatio) ? 'object-cover' : 'h-auto'"
            :style="
              ratioStyle(ex.aspectRatio)
                ? { aspectRatio: ratioStyle(ex.aspectRatio) }
                : undefined
            "
          />
          <div
            v-if="ex.caption"
            class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3"
          >
            <p class="text-[11px] text-white/90 line-clamp-2">
              {{ ex.caption }}
            </p>
          </div>
        </component>
      </div>
    </section>

    <!-- How it works -->
    <section class="max-w-5xl mx-auto px-4 py-12">
      <div class="text-center mb-10">
        <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Three simple steps to your first result
        </p>
      </div>
      <div class="grid sm:grid-cols-3 gap-5">
        <div
          v-for="(step, i) in USE_CASE_STEPS"
          :key="i"
          class="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
        >
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white font-display font-bold text-sm shadow-glow-brand mb-4"
          >
            {{ i + 1 }}
          </span>
          <h3 class="font-display font-semibold text-base mb-1.5">
            {{ step.title }}
          </h3>
          <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {{ step.description }}
          </p>
        </div>
      </div>
    </section>

    <!-- Benefits -->
    <section class="max-w-5xl mx-auto px-4 py-12">
      <div class="grid sm:grid-cols-3 gap-5">
        <div
          v-for="benefit in uc.benefits"
          :key="benefit.title"
          class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
        >
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 mb-4"
          >
            <UIcon :name="`i-lucide-${benefit.icon}`" class="size-5" />
          </span>
          <h3 class="font-display font-semibold text-base mb-1.5">
            {{ benefit.title }}
          </h3>
          <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {{ benefit.description }}
          </p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="max-w-3xl mx-auto px-4 py-12">
      <div class="text-center mb-8">
        <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Frequently asked questions
        </h2>
      </div>
      <div class="space-y-3">
        <details
          v-for="faq in uc.faqs"
          :key="faq.question"
          class="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4"
        >
          <summary
            class="flex items-center justify-between cursor-pointer list-none font-medium text-sm sm:text-base"
          >
            {{ faq.question }}
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 text-zinc-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <p
            class="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed"
          >
            {{ faq.answer }}
          </p>
        </details>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="max-w-4xl mx-auto px-4 py-12">
      <div
        class="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 p-8 sm:p-12 text-center"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-grain opacity-10 mix-blend-overlay"
        />
        <h2
          class="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3"
        >
          Ready to create?
        </h2>
        <p
          class="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mb-6 max-w-lg mx-auto"
        >
          Start with free credits — no credit card needed. Your first result is
          seconds away.
        </p>
        <UButton
          :to="generateLink"
          size="lg"
          class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 hover:animate-gradient-pan transition-all"
        >
          <UIcon name="i-lucide-sparkles" class="size-4" />
          {{ `Open the ${uc.label} tool` }}
        </UButton>
      </div>
    </section>

    <!-- More tools (internal linking) -->
    <section class="max-w-5xl mx-auto px-4 pb-16">
      <h2 class="font-display text-lg font-bold tracking-tight mb-4">
        More AI tools
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NuxtLink
          v-for="tool in otherTools"
          :key="tool.slug"
          :to="`/ai/${tool.slug}`"
          class="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-primary/40 transition-colors"
        >
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 mb-3"
          >
            <UIcon :name="`i-lucide-${tool.icon}`" class="size-4" />
          </span>
          <p
            class="text-sm font-semibold group-hover:text-primary transition-colors"
          >
            {{ tool.label }}
          </p>
          <p
            class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-2"
          >
            {{ tool.tagline }}
          </p>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
