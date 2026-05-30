<script setup lang="ts">
type Section = {
  title: string;
  body: string[];
  list?: string[];
};

const highlights = [
  {
    title: "Credit-based access",
    description: "Buy credits, use them when you’re ready, and credits never expire.",
  },
  {
    title: "Respectful creations",
    description: "We expect every generation to obey community standards and copyright law.",
  },
  {
    title: "Transparent changes",
    description: "We will notify you in-app when we update these terms or the policy.",
  },
];

const sections: Section[] = [
  {
    title: "Acceptance of Terms",
    body: [
      "These Terms of Service govern your access to and use of Lumiar (the “Service”). By using the Service, you agree to comply with and be bound by these Terms.",
      "If you do not agree with any part of these Terms, please do not use the Service.",
    ],
  },
  {
    title: "Creating and Managing an Account",
    body: [
      "You must be at least 18 years old and provide accurate information when creating an account. You are responsible for keeping your credentials confidential and for all activity that occurs under your account.",
      "Notify us immediately if you suspect any unauthorized use of your account.",
    ],
  },
  {
    title: "Using the Platform",
    body: [
      "You may submit prompts, upload reference images, and request AI-generated outputs, subject to the limits of your selected model and credits.",
      "You agree not to reverse engineer, abuse, or otherwise interfere with the Service, its APIs, or its infrastructure.",
    ],
    list: [
      "Purchasing credits unlocks image generation; the price per generation depends on the selected model.",
      "The Service may apply rate limits to protect platform stability.",
      "We reserve the right to suspend access if usage violates these Terms.",
    ],
  },
  {
    title: "Content Ownership and Use",
    body: [
      "You retain ownership of the prompts and images you provide, subject to the limited licenses outlined in the Privacy Policy.",
      "By uploading content, you grant us a non-exclusive license to host, display, and distribute it as needed to provide the Service.",
    ],
  },
  {
    title: "Payments and Credits",
    body: [
      "Credits purchased through Lumiar do not expire, but they are non-refundable except where required by applicable law.",
      "We may change pricing, promotions, and available credit packs at our discretion; those changes apply only to future purchases.",
    ],
  },
  {
    title: "Prohibited Conduct",
    body: [
      "Do not request or create content that violates laws, promotes harassment, or infringes on third-party rights.",
    ],
    list: [
      "Uploading copyrighted materials you do not own or have permission to use.",
      "Attempting to bypass moderation, rate limits, or security rules.",
      "Impersonating another person or entity while interacting with the Service.",
    ],
  },
  {
    title: "Termination",
    body: [
      "We may suspend or terminate your access with or without notice if you materially breach these Terms.",
      "You may also delete your account at any time through the account settings page; residual copies of data may persist for technical reasons.",
    ],
  },
  {
    title: "Disclaimers and Liability",
    body: [
      "The Service is provided “as is” without warranties. We do not guarantee that the outputs will be perfect or suitable for every use case.",
      "To the fullest extent permitted by law, our liability is limited to the amount you paid for the Service in the prior 12 months.",
    ],
  },
  {
    title: "Changes to Terms",
    body: [
      "We may update these Terms from time to time. We will post the revised version on the site and, when appropriate, notify you through the app or by email.",
      "Your continued use after those updates constitutes acceptance of the revised Terms.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about these Terms can be directed to hello@lumiar.com or through the in-app support widget.",
    ],
  },
];
</script>

<template>
  <div class="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <div class="max-w-5xl mx-auto px-4 py-16 space-y-12">
      <div class="text-center space-y-4">
        <img src="/logo.svg" alt="Lumiar logo" class="mx-auto h-12 w-auto" />
        <p class="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-500">
          Terms of Service
        </p>
        <h1 class="text-4xl font-semibold tracking-tight">
          Responsible AI for creators, with clear rules you can trust.
        </h1>
        <p class="text-base text-zinc-500 dark:text-zinc-400">
          These terms explain what we expect from everyone who uses Lumiar and what you can expect from us.
        </p>
      </div>

      <div class="grid md:grid-cols-3 gap-5">
        <div
          v-for="highlight in highlights"
          :key="highlight.title"
          class="rounded-2xl border border-zinc-200/60 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/70 p-5 shadow-sm text-left"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
            {{ highlight.title }}
          </p>
          <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-300">
            {{ highlight.description }}
          </p>
        </div>
      </div>

      <div class="space-y-10">
        <section
          v-for="section in sections"
          :key="section.title"
          class="rounded-3xl border border-zinc-200/70 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/60 p-6 space-y-3 shadow-sm"
        >
          <h2 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {{ section.title }}
          </h2>
          <div class="space-y-3">
            <p
              v-for="paragraph in section.body"
              :key="paragraph"
              class="text-sm text-zinc-600 dark:text-zinc-300"
            >
              {{ paragraph }}
            </p>
            <ul
              v-if="section.list"
              class="space-y-1 text-sm text-zinc-600 dark:text-zinc-300 list-disc list-inside"
            >
              <li v-for="item in section.list" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
