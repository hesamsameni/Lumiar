<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Lumiar Nuxt 4 application. The `@posthog/nuxt` module was installed and configured, providing automatic client-side pageview tracking, Vue exception capture, and server-side Nitro error capture. A shared `server/utils/posthog.ts` utility was created for server-side event tracking using `posthog-node`. Environment variables were set in `.env` and wired into `nuxt.config.ts` via `runtimeConfig`. Nine custom events were instrumented across six files covering the full user journey: authentication, image generation, and credits purchase.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully registered a new account (email/password) | `app/pages/auth/register.vue` |
| `user_logged_in` | User successfully signed in with password | `app/pages/auth/login.vue` |
| `image_generation_started` | User initiated an image generation with model/prompt details | `app/composables/useGeneration.ts` |
| `image_generation_completed` | Image generation succeeded — model, tokens used, aspect ratio | `app/composables/useGeneration.ts` |
| `image_generation_failed` | Image generation failed — error category for triage | `app/composables/useGeneration.ts` |
| `checkout_initiated` | User clicked 'Pay with Stripe' — amount and credit pack details | `app/pages/credits.vue` |
| `payment_completed` | Stripe webhook confirmed payment — server-side, userId + tokens | `server/api/stripe/webhook.post.ts` |
| `image_generated` | Server-side confirmation image was saved — correlates with client via PostHog headers | `server/api/generate.post.ts` |
| `prompt_polished` | User used the AI prompt polish feature | `app/pages/index.vue` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1597710)
- [New Signups & Logins over time](/insights/cqOgEaTE) — daily trend of registrations and logins
- [Signup → Generation Funnel](/insights/WPbtrVkH) — activation funnel from signup to first completed generation
- [Credits Purchase Funnel](/insights/8nnijuVk) — payment conversion from checkout initiation to confirmed payment
- [Image Generations over time](/insights/Z2mD4tYH) — daily volume of completed image generations
- [Generation Success vs Failure rate](/insights/p9yWVcdo) — reliability monitor: completions vs failures

## LLM analytics

PostHog LLM analytics were added to capture `$ai_generation` events for every AI call in the application. The integration uses OpenTelemetry auto-instrumentation for providers whose SDKs support it, and manual capture for the raw-fetch OpenRouter image generation path.

**Packages installed:** `@posthog/ai`, `@opentelemetry/sdk-node`, `@opentelemetry/resources`, `@opentelemetry/instrumentation-openai`, `@traceloop/instrumentation-google-generativeai`

### How it works

| Provider | Coverage | Method |
|---|---|---|
| **OpenAI** (image generation) | `server/utils/providers/openai.ts` — `images.generate`, `images.edit` | OTel auto-capture via `@opentelemetry/instrumentation-openai` |
| **Google GenAI** (Gemini) | `server/utils/providers/google.ts` — `generateContent` | OTel auto-capture via `@traceloop/instrumentation-google-generativeai` |
| **OpenRouter** (prompt polish) | `server/api/polish-prompt.post.ts` — `chat.completions.create` via OpenAI SDK | OTel auto-capture via `@opentelemetry/instrumentation-openai` |
| **OpenRouter** (image generation) | `server/utils/providers/openrouter.ts` — raw `$fetch` to `/chat/completions` | Manual `$ai_generation` capture with model, token counts, and latency |

### New files

- `server/plugins/posthog-otel.ts` — Nitro plugin that starts the OpenTelemetry SDK on server boot, wiring up the PostHog span processor and both instrumentations.

### Events captured

All three paths produce `$ai_generation` events in PostHog with properties including `$ai_model`, `$ai_provider`, `$ai_input_tokens`, `$ai_output_tokens`, and `$ai_latency`. These appear in the [LLM Analytics](/llm-analytics/generations) section of PostHog.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
