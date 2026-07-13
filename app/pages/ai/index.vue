<script setup lang="ts">
import { USE_CASES } from "~/utils/useCases";

const config = useRuntimeConfig();
const siteUrl = (
  (config.public.siteUrl as string) || "https://www.lumiar.site"
).replace(/\/$/, "");
const canonical = `${siteUrl}/ai`;

const title = "Free AI Image & Photo Tools | Lumiar";
const description =
  "Explore Lumiar's AI tools: headshot generator, photo restoration, anime art, logo maker, product photography, interior design and more. Try free.";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: canonical,
  ogType: "website",
  twitterCard: "summary_large_image",
  twitterTitle: title,
  twitterDescription: description,
});

useHead({
  link: [{ rel: "canonical", href: canonical }],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: USE_CASES.map((u, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: u.heading,
          url: `${siteUrl}/ai/${u.slug}`,
        })),
      }),
    },
  ],
});
</script>

<template>
  <div class="relative isolate">
    <section class="relative isolate">
      <AuroraBackdrop />
      <div class="max-w-3xl mx-auto px-4 pt-16 sm:pt-24 pb-10 text-center">
        <span
          class="inline-flex items-center gap-1.5 mb-5 rounded-full border border-zinc-200/80 dark:border-zinc-700/60 bg-white/60 dark:bg-zinc-900/50 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
        >
          <UIcon name="i-lucide-wand-2" class="size-3 text-primary" />
          AI Tools
        </span>
        <h1
          class="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-4"
        >
          AI tools for
          <span class="text-gradient-brand animate-gradient-pan"
            >every idea</span
          >
        </h1>
        <p class="text-base sm:text-lg text-zinc-500 dark:text-zinc-400">
          Purpose-built AI image and photo tools — pick one and create in
          seconds.
        </p>
      </div>
    </section>

    <section class="max-w-6xl mx-auto px-4 pb-20">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="tool in USE_CASES"
          :key="tool.slug"
          :to="`/ai/${tool.slug}`"
          class="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-primary/40 hover:shadow-glow-brand/20 transition-all"
        >
          <span
            class="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-1 ring-primary/15 mb-4"
          >
            <UIcon :name="`i-lucide-${tool.icon}`" class="size-5" />
          </span>
          <h2
            class="font-display font-bold text-lg tracking-tight group-hover:text-primary transition-colors"
          >
            {{ tool.heading }}
          </h2>
          <p
            class="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed"
          >
            {{ tool.tagline }}
          </p>
          <span
            class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            Try it
            <UIcon
              name="i-lucide-arrow-right"
              class="size-3.5 group-hover:translate-x-0.5 transition-transform"
            />
          </span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
