import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        {
          name: "description",
          content: "Lumiar – AI-powered photo editing and generation.",
        },
      ],
    },
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/supabase"],

  supabase: {
    types: resolve(__dirname, "app/types/database.types.ts"),
    redirectOptions: {
      login: "/auth/login",
      callback: "/auth/callback",
      include: ["/profile(/*)?", "/generation/new", "/admin(/*)?", "/credits"],
      exclude: [
        "/",
        "/explore",
        "/generation/*",
        "/auth/*",
        "/prompt-library",
        "/api/stripe/webhook",
      ],
    },
  },

  runtimeConfig: {
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    bunnyApiKey: process.env.BUNNY_API_KEY,
    bunnyStorageZone: process.env.BUNNY_STORAGE_ZONE,
    bunnyStorageHostname: process.env.BUNNY_STORAGE_HOSTNAME,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      bunnyCdnUrl: process.env.BUNNY_CDN_URL,
    },
  },

  css: [resolve(__dirname, "app/assets/css/main.css")],
});
