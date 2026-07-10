<script setup lang="ts">
type Section = {
  title: string;
  body: string[];
  list?: string[];
};

const highlights = [
  {
    title: "Minimal data",
    description:
      "We collect only the information needed to run the service and improve your experience.",
  },
  {
    title: "Security-first",
    description:
      "Backups, encryption, and Cloudflare R2 storage help keep your files protected.",
  },
  {
    title: "You stay in control",
    description:
      "You can export, delete, or update your data anytime via the profile settings.",
  },
];

const sections: Section[] = [
  {
    title: "Privacy at a glance",
    body: [
      "This policy explains how Lumiar collects, uses, discloses, and safeguards your information when you visit or use the Service.",
      "We rely on consent and legitimate business interests, and we never sell your personal data.",
    ],
  },
  {
    title: "Information We Collect",
    body: [
      "We collect data you provide directly, such as account details, prompts, and uploaded images.",
      "We also gather usage data automatically to monitor performance and detect abuse.",
    ],
    list: [
      "Account info: email, name, profile settings, and payment identifiers.",
      "Content: prompts, reference images, generated creations, and feedback.",
      "Device info: IP address, browser type, and interaction timestamps.",
    ],
  },
  {
    title: "How We Use Your Data",
    body: [
      "We use your data to authenticate you, provision AI generations, troubleshoot issues, and send relevant updates.",
      "Aggregated usage data helps us improve models, fix bugs, and design new features.",
    ],
    list: [
      "Deliver core services like login, image generation, and credit management.",
      "Send system messages, security alerts, and optional marketing when you opt in.",
      "Analyze trends to keep the platform fast and reliable.",
    ],
  },
  {
    title: "Cookies and Similar Technologies",
    body: [
      "We use cookies and local storage to remember preferences and keep sessions alive.",
      "Third-party cookies are also used for analytics (PostHog) and payments (Stripe).",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "We rely on trusted partners for identity (Supabase), payments (Stripe), analytics (PostHog), model hosting, and storage (Cloudflare R2).",
      "When you interact with these services, their respective privacy policies apply in addition to ours.",
    ],
  },
  {
    title: "Data Security",
    body: [
      "We encrypt data in transit and at rest, restrict internal access, and maintain monitoring to detect suspicious activity.",
      "Despite our protections, no system is perfect, so please protect your password and device.",
    ],
  },
  {
    title: "Legal Basis & Your Rights",
    body: [
      "When required, we rely on your consent or legitimate interest to process your data.",
      "You may review, update, export, or delete your personal information by visiting your profile settings or emailing us.",
    ],
    list: [
      "Right of access — request the information we have about you.",
      "Right to rectification — correct inaccurate data.",
      "Right to erasure — delete data when possible.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "We retain account data for as long as you remain active, plus a reasonable transition period afterward.",
      "For legal or security reasons, some logs may persist longer even after account deletion.",
    ],
  },
  {
    title: "Children",
    body: [
      "Lumiar is not intended for individuals under 18. If we learn a minor created an account, we will delete it upon verification.",
    ],
  },
  {
    title: "Policy Updates & Contact",
    body: [
      "We may update this policy from time to time. The ‘Last Updated’ date at the top will reflect changes.",
      "If you have questions or a data request, email privacy@lumiar.com or use the support widget.",
    ],
  },
];
</script>

<template>
  <div
    class="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
  >
    <div class="max-w-5xl mx-auto px-4 py-16 space-y-12">
      <div class="text-center space-y-4">
        <img src="/logo.svg" alt="Lumiar logo" class="mx-auto h-12 w-auto" />
        <p
          class="text-xs font-semibold uppercase tracking-[0.4em] text-gradient-brand"
        >
          Privacy Policy
        </p>
        <h1 class="font-display text-4xl font-bold tracking-tight">
          Your data stays yours—transparent collection, clear controls.
        </h1>
        <p class="text-base text-zinc-500 dark:text-zinc-400">
          We describe what we collect, how we protect it, and how you can shape
          your experience.
        </p>
      </div>

      <div class="grid md:grid-cols-3 gap-5">
        <div
          v-for="highlight in highlights"
          :key="highlight.title"
          class="rounded-2xl border border-zinc-200/70 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/80 p-5 shadow-sm text-left"
        >
          <p
            class="text-xs font-semibold uppercase tracking-[0.3em] text-gradient-brand"
          >
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
          class="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/90 p-6 space-y-3 shadow-sm"
        >
          <h2 class="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {{ section.title }}
          </h2>
          <div class="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <p v-for="paragraph in section.body" :key="paragraph">
              {{ paragraph }}
            </p>
            <ul
              v-if="section.list"
              class="space-y-1 list-disc list-inside text-zinc-500 dark:text-zinc-300"
            >
              <li v-for="item in section.list" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
