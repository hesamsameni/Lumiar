<script setup lang="ts">
const PACKS: Array<{
  id: string;
  label: string;
  euros: number;
  credits: number;
  featured?: boolean;
}> = [
  { id: "starter", label: "Starter", euros: 2, credits: 200 },
  { id: "basic", label: "Basic", euros: 5, credits: 550 },
  { id: "popular", label: "Popular", euros: 10, credits: 1200, featured: true },
  { id: "pro", label: "Pro", euros: 25, credits: 3250 },
];

const FAST_MODEL_COST = 3; // GPT Image 1 Mini — cheapest active model
const PREMIUM_MODEL_COST = 15; // GPT Image 2 — most expensive active model

function packHint(credits: number) {
  return {
    fast: Math.floor(credits / FAST_MODEL_COST),
    premium: Math.floor(credits / PREMIUM_MODEL_COST),
  };
}

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const toast = useToast();
const { balance, fetchBalance } = useTokens();
const posthog = usePostHog();

const selectedPackId = ref<string | null>(null);
const customEuros = ref("");
const isLoading = ref(false);

const showSuccess = ref(route.query.success === "true");
const showCanceled = ref(route.query.canceled === "true");

onMounted(async () => {
  if (showSuccess.value) {
    await fetchBalance();
    await router.replace("/credits");
  }
});

const selectedPack = computed(
  () => PACKS.find((p) => p.id === selectedPackId.value) ?? null,
);

const customEurosNum = computed(() => {
  const n = parseFloat(customEuros.value);
  return !isNaN(n) && n > 0 ? n : null;
});

const finalEuros = computed(() => {
  if (selectedPackId.value) return selectedPack.value?.euros ?? null;
  return customEurosNum.value;
});

const finalCredits = computed(() => {
  if (selectedPack.value) return selectedPack.value.credits;
  if (finalEuros.value === null) return null;
  return Math.floor(finalEuros.value * 100);
});

const isValid = computed(
  () => finalEuros.value !== null && finalEuros.value >= 2,
);

const customTooLow = computed(
  () =>
    !selectedPackId.value &&
    customEurosNum.value !== null &&
    customEurosNum.value < 2,
);

function selectPack(id: string) {
  selectedPackId.value = selectedPackId.value === id ? null : id;
  customEuros.value = "";
}

function onCustomInput() {
  selectedPackId.value = null;
}

async function startCheckout() {
  if (!isValid.value || !finalEuros.value) return;
  isLoading.value = true;
  posthog?.capture("checkout_initiated", {
    amount_euros: finalEuros.value,
    credits: finalCredits.value,
    pack_id: selectedPackId.value ?? "custom",
  });
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const { url } = await $fetch<{ url: string }>("/api/stripe/checkout", {
      method: "POST",
      body: { amountEuros: finalEuros.value, credits: finalCredits.value },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    window.location.href = url!;
  } catch {
    toast.add({
      title: "Checkout failed",
      description: "Please try again.",
      color: "error",
    });
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-16 relative isolate">
    <AuroraBackdrop />

    <!-- Success banner -->
    <Transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="showSuccess"
        class="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
      >
        <UIcon
          name="i-lucide-check-circle-2"
          class="size-5 text-emerald-500 flex-shrink-0 mt-0.5"
        />
        <div>
          <p class="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Payment successful!
          </p>
          <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            Your credits have been added to your account.
          </p>
        </div>
      </div>
    </Transition>

    <!-- Canceled banner -->
    <Transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="showCanceled"
        class="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
      >
        <UIcon
          name="i-lucide-x-circle"
          class="size-5 text-zinc-400 flex-shrink-0"
        />
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          Payment canceled — no charges were made.
        </p>
      </div>
    </Transition>

    <!-- Hero -->
    <div class="mb-10 text-center">
      <h1
        class="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-1.5"
      >
        Buy <span class="text-gradient-brand">Credits</span>
      </h1>
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        No subscriptions. Pay once, use whenever.
      </p>
      <div
        v-if="balance !== null"
        class="mt-4 inline-flex rounded-full p-px bg-gradient-brand"
      >
        <span
          class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-zinc-950 text-sm font-medium"
        >
          <UIcon name="i-lucide-zap" class="size-4 text-amber-500" />
          <span
            >Current balance:
            <strong class="tabular-nums">{{
              balance.toLocaleString()
            }}</strong>
            credits</span
          >
        </span>
      </div>
    </div>

    <!-- Pack cards -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <button
        v-for="pack in PACKS"
        :key="pack.id"
        type="button"
        class="relative flex flex-col items-center text-center px-4 py-5 rounded-2xl border-2 transition-all focus:outline-none"
        :class="
          selectedPackId === pack.id
            ? 'border-primary/50 bg-gradient-to-br from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/20 shadow-sm'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
        "
        @click="selectPack(pack.id)"
      >
        <span
          v-if="pack.featured"
          class="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-brand text-white shadow-glow-brand whitespace-nowrap"
        >
          Popular
        </span>
        <UIcon
          name="i-lucide-zap"
          class="size-6 mb-2.5"
          :class="
            selectedPackId === pack.id ? 'text-primary' : 'text-amber-500'
          "
        />
        <span
          class="text-2xl font-bold tracking-tight"
          :class="
            selectedPackId === pack.id
              ? 'text-primary'
              : 'text-zinc-900 dark:text-zinc-100'
          "
        >
          €{{ pack.euros }}
        </span>
        <span class="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">
          {{ pack.credits.toLocaleString() }} credits
        </span>
        <span
          class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 leading-tight"
        >
          ~{{ packHint(pack.credits).premium }} premium · ~{{
            packHint(pack.credits).fast
          }}
          fast
        </span>
        <UIcon
          name="i-lucide-check-circle-2"
          class="size-4 mt-2 transition-opacity"
          :class="
            selectedPackId === pack.id
              ? 'text-primary opacity-100'
              : 'opacity-0'
          "
        />
      </button>
    </div>

    <!-- Generation hint callout -->
    <div
      class="mb-6 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5"
    >
      <UIcon
        name="i-lucide-zap"
        class="size-4 text-amber-500 flex-shrink-0 mt-0.5"
      />
      <p class="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        <strong>€10</strong> gets you ~{{ packHint(1200).premium }} images with
        premium models, or ~{{ packHint(1200).fast }} images with fast models.
        Credits never expire — use them at your own pace.
      </p>
    </div>

    <!-- Custom amount -->
    <div class="flex items-center gap-3 mb-6">
      <div
        class="flex-1 h-px bg-gradient-to-r from-transparent to-zinc-200 dark:to-zinc-800"
      />
      <span class="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap"
        >or enter a custom amount</span
      >
      <div
        class="flex-1 h-px bg-gradient-to-l from-transparent to-zinc-200 dark:to-zinc-800"
      />
    </div>

    <div class="mb-8">
      <div
        class="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all"
        :class="
          !selectedPackId && customEuros
            ? 'border-primary/50 bg-gradient-to-br from-indigo-500/10 via-violet-500/8 to-fuchsia-500/10 ring-1 ring-primary/20'
            : 'border-zinc-200 dark:border-zinc-800 focus-within:border-zinc-300 dark:focus-within:border-zinc-700'
        "
      >
        <span class="text-sm font-semibold text-zinc-400 flex-shrink-0">€</span>
        <input
          v-model="customEuros"
          type="number"
          min="2"
          step="1"
          placeholder="Enter amount (min €2)"
          class="flex-1 bg-transparent text-sm outline-none placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100"
          @input="onCustomInput"
        />
        <span
          v-if="customEurosNum && customEurosNum >= 2"
          class="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0"
        >
          = {{ Math.floor(customEurosNum * 100).toLocaleString() }} credits
        </span>
      </div>
      <p v-if="customTooLow" class="text-xs text-red-500 mt-1.5 ml-1">
        Minimum amount is €2
      </p>
    </div>

    <!-- Summary + CTA -->
    <div
      class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm"
    >
      <div class="space-y-3 mb-5">
        <div class="flex items-center justify-between text-sm">
          <span class="text-zinc-500 dark:text-zinc-400">You'll receive</span>
          <span class="font-semibold">
            <template v-if="finalCredits">
              {{ finalCredits.toLocaleString() }} credits
            </template>
            <span v-else class="text-zinc-300 dark:text-zinc-600">—</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-zinc-500 dark:text-zinc-400">Total</span>
          <span class="font-bold text-lg">
            <template v-if="finalEuros">€{{ finalEuros }}</template>
            <span v-else class="text-zinc-300 dark:text-zinc-600 text-base"
              >—</span
            >
          </span>
        </div>
      </div>

      <UButton
        block
        size="lg"
        icon="i-lucide-credit-card"
        :loading="isLoading"
        :disabled="!isValid"
        class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 disabled:!brightness-100 disabled:shadow-none transition-all"
        @click="startCheckout"
      >
        {{ isLoading ? "Redirecting to Stripe…" : "Pay with Stripe" }}
      </UButton>

      <p
        class="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-3 flex items-center justify-center gap-1.5"
      >
        <UIcon name="i-lucide-lock" class="size-3" />
        Secured by Stripe · We never store card details
      </p>
    </div>

    <!-- Rate info -->
    <p class="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-6">
      100 credits = €1 · Credits never expire
    </p>
    <p class="text-center text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
      Different AI models use different amounts of credits.
    </p>

    <!-- Referral -->
    <div class="mt-8">
      <ReferralWidget />
    </div>
  </div>
</template>
