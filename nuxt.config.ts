import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = process.env.NUXT_PUBLIC_SITE_URL || "https://www.lumiar.site";
const OG_TITLE = "Lumiar – AI Image Generator & Photo Editor";
const OG_DESCRIPTION =
  "Generate stunning images and edit photos with GPT, Gemini, Flux and more. Powered by the world's best AI models.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: "Lumiar",
      viewport: "width=device-width, initial-scale=1, maximum-scale=1",
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "96x96",
          href: "/favicon-96x96.png",
        },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      meta: [
        { name: "theme-color", content: "#0f172a" },
        { name: "description", content: OG_DESCRIPTION },
        // Open Graph — WhatsApp, Telegram, Facebook, LinkedIn
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Lumiar" },
        { property: "og:title", content: OG_TITLE },
        { property: "og:description", content: OG_DESCRIPTION },
        { property: "og:url", content: SITE_URL },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/png" },
        // Twitter / X Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: OG_TITLE },
        { name: "twitter:description", content: OG_DESCRIPTION },
        { name: "twitter:image", content: OG_IMAGE },
      ],
    },
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/supabase", "@posthog/nuxt"],

  supabase: {
    types: resolve(__dirname, "app/types/database.types.ts"),
    redirectOptions: {
      login: "/auth/login",
      callback: "/auth/callback",
      include: ["/profile(/*)?", "/generation/new", "/admin(/*)?", "/credits"],
      exclude: [
        "/",
        "/explore",
        "/models",
        "/models/*",
        "/generation/*",
        "/auth/*",
        "/prompt-library",
        "/api/**",
      ],
    },
  },

  runtimeConfig: {
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      siteUrl: SITE_URL,
      r2PublicUrl: process.env.R2_PUBLIC_URL,
      posthog: {
        publicKey: process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "",
        host:
          process.env.NUXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      },
    },
  },

  posthogConfig: {
    publicKey: process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "",
    host: process.env.NUXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    clientConfig: {
      capture_exceptions: true,
      __add_tracing_headers: ["localhost", "lumiar.app"],
    },
    serverConfig: {
      enableExceptionAutocapture: true,
    },
  },

  css: [resolve(__dirname, "app/assets/css/main.css")],
});
