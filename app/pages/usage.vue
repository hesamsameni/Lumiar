<script setup lang="ts">
const CREDIT_TO_USD = 0.0083;
const PROVIDER_COST_RATIO = 0.5; // credits target ~2x provider cost

const { isAuthenticated, session } = useAuthState();

type TypeFilter = "all" | "image" | "video";

interface UsageModel {
  model_id: string;
  model_name: string;
  type: "image" | "video";
  count: number;
  total_credits: number;
  total_provider_cost?: number | null;
  first_used: string;
  last_used: string;
}

interface UsageUser {
  id: string;
  username: string | null;
  email: string | null;
}

interface UsageResponse {
  models: UsageModel[];
  totalCredits: number;
  totalImages: number;
  totalVideos: number;
  totalProviderCost: number | null;
  isAdmin: boolean;
  canSeeProviderCost: boolean;
  users: UsageUser[];
  targetUserId: string;
}

const loading = ref(true);
const error = ref<string | null>(null);
const data = ref<UsageResponse | null>(null);
const typeFilter = ref<TypeFilter>("all");
const selectedUserId = ref<string | null>(null);
const dateFrom = ref<string>("");
const dateTo = ref<string>("");

async function fetchUsage(userId?: string | null) {
  if (!isAuthenticated.value) {
    await navigateTo("/auth/login");
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const accessToken = session.value?.access_token;
    const params: Record<string, string> = {};
    const uid = userId !== undefined ? userId : selectedUserId.value;
    if (uid) params.userId = uid;
    if (dateFrom.value) params.from = new Date(dateFrom.value).toISOString();
    if (dateTo.value) {
      const end = new Date(dateTo.value);
      end.setHours(23, 59, 59, 999);
      params.to = end.toISOString();
    }
    data.value = await $fetch<UsageResponse>("/api/usage", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      params,
    });
  } catch (err: unknown) {
    error.value =
      err instanceof Error ? err.message : "Failed to load usage data";
  } finally {
    loading.value = false;
  }
}

function onUserChange(userId: string | null) {
  selectedUserId.value = userId;
  fetchUsage(userId);
}

function onDateChange() {
  fetchUsage();
}

function clearDateRange() {
  dateFrom.value = "";
  dateTo.value = "";
  fetchUsage();
}

onMounted(fetchUsage);

const selectedUserLabel = computed(() => {
  if (!selectedUserId.value || !data.value) return "My Usage";
  const u = data.value.users.find((u) => u.id === selectedUserId.value);
  return u?.username || u?.id?.slice(0, 8) || "Unknown";
});

const filteredModels = computed(() => {
  if (!data.value) return [];
  if (typeFilter.value === "all") return data.value.models;
  return data.value.models.filter((m) => m.type === typeFilter.value);
});

const filteredCredits = computed(() =>
  filteredModels.value.reduce((s, m) => s + m.total_credits, 0),
);
const filteredCount = computed(() =>
  filteredModels.value.reduce((s, m) => s + m.count, 0),
);

function providerCost(row: UsageModel): number {
  if (row.total_provider_cost != null && row.total_provider_cost > 0) {
    return row.total_provider_cost;
  }
  return row.total_credits * CREDIT_TO_USD * PROVIDER_COST_RATIO;
}

function formatUsd(amount: number): string {
  return amount < 0.01 ? `<$0.01` : `$${amount.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-16 sm:py-20">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-2">
        <UIcon name="i-lucide-bar-chart-3" class="size-5 text-primary" />
        <h1 class="text-2xl font-bold tracking-tight">Usage</h1>
      </div>
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        Track your credit spending and model usage across all generations.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 3"
        :key="i"
        class="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800/60"
      />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-center"
    >
      <UIcon name="i-lucide-alert-circle" class="size-6 text-red-500 mb-2" />
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <UButton
        size="sm"
        variant="outline"
        class="mt-3"
        @click="() => fetchUsage(selectedUserId)"
      >
        Retry
      </UButton>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="data && data.models.length === 0"
      class="rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center"
    >
      <UIcon
        name="i-lucide-image-plus"
        class="size-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3"
      />
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        No generations yet. Start creating to see your usage here!
      </p>
      <div class="flex justify-center gap-2 mt-4">
        <UButton to="/" size="sm" variant="outline">Create Image</UButton>
        <UButton to="/video" size="sm" variant="outline">Create Video</UButton>
      </div>
    </div>

    <!-- Data -->
    <template v-else-if="data">
      <!-- Admin user picker -->
      <div
        v-if="data.isAdmin && data.users.length"
        class="mb-6 flex items-center gap-3"
      >
        <UIcon
          name="i-lucide-users"
          class="size-4 text-amber-500 flex-shrink-0"
        />
        <span class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Viewing:
        </span>
        <select
          :value="selectedUserId ?? ''"
          class="flex-1 max-w-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          @change="
            onUserChange(($event.target as HTMLSelectElement).value || null)
          "
        >
          <option value="">My Usage</option>
          <option v-for="u in data.users" :key="u.id" :value="u.id">
            {{ u.username || u.id.slice(0, 8) }}
          </option>
        </select>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div
          class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
        >
          <p
            class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
          >
            Total Credits
          </p>
          <p
            class="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums"
          >
            {{ data.totalCredits.toLocaleString() }}
          </p>
          <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            ≈ {{ formatUsd(data.totalCredits * CREDIT_TO_USD) }}
          </p>
        </div>
        <div
          class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
        >
          <p
            class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
          >
            Images
          </p>
          <p
            class="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums"
          >
            {{ data.totalImages.toLocaleString() }}
          </p>
        </div>
        <div
          class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
        >
          <p
            class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1"
          >
            Videos
          </p>
          <p
            class="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums"
          >
            {{ data.totalVideos.toLocaleString() }}
          </p>
        </div>
        <div
          v-if="data.canSeeProviderCost"
          class="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4"
        >
          <p
            class="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1"
          >
            Provider Cost
          </p>
          <p
            class="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums"
          >
            {{
              formatUsd(data.models.reduce((s, m) => s + providerCost(m), 0))
            }}
          </p>
          <p class="text-xs text-amber-500 dark:text-amber-600 mt-0.5">
            Admin only · includes estimates
          </p>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div
          class="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
        >
          <button
            v-for="opt in [
              { value: 'all', label: 'All', icon: 'i-lucide-layers' },
              { value: 'image', label: 'Images', icon: 'i-lucide-image' },
              { value: 'video', label: 'Videos', icon: 'i-lucide-video' },
            ] as const"
            :key="opt.value"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            :class="
              typeFilter === opt.value
                ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-700/60'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            "
            @click="typeFilter = opt.value"
          >
            <UIcon :name="opt.icon" class="size-3.5" />
            {{ opt.label }}
          </button>
        </div>

        <div class="flex items-center gap-2 sm:ml-auto">
          <div class="flex items-center gap-1.5">
            <UIcon
              name="i-lucide-calendar"
              class="size-3.5 text-zinc-400 flex-shrink-0"
            />
            <input
              v-model="dateFrom"
              type="date"
              class="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 w-[130px]"
              @change="onDateChange"
            />
            <span class="text-xs text-zinc-400">–</span>
            <input
              v-model="dateTo"
              type="date"
              class="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/50 w-[130px]"
              @change="onDateChange"
            />
          </div>
          <button
            v-if="dateFrom || dateTo"
            type="button"
            class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            title="Clear date range"
            @click="clearDateRange"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
        </div>
      </div>

      <div class="flex items-center justify-end mb-2">
        <span class="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
          {{ filteredCount.toLocaleString() }} generation{{
            filteredCount === 1 ? "" : "s"
          }}
          · {{ filteredCredits.toLocaleString() }} credits
        </span>
      </div>

      <!-- Table -->
      <div
        class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="border-b border-zinc-100 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                <th class="text-left px-4 py-3">Model</th>
                <th class="text-left px-4 py-3">Type</th>
                <th class="text-right px-4 py-3">Count</th>
                <th class="text-right px-4 py-3">Credits</th>
                <th class="text-right px-4 py-3">Est. Spent</th>
                <th
                  v-if="data.canSeeProviderCost"
                  class="text-right px-4 py-3 text-amber-500"
                >
                  Actual Cost
                </th>
                <th class="text-right px-4 py-3">Last Used</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
              <tr
                v-for="row in filteredModels"
                :key="`${row.type}:${row.model_id}`"
                class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <td class="px-4 py-3">
                  <p
                    class="font-medium text-zinc-900 dark:text-white truncate max-w-[200px]"
                  >
                    {{ row.model_name }}
                  </p>
                  <p
                    class="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]"
                  >
                    {{ row.model_id }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    :class="
                      row.type === 'image'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    "
                  >
                    <UIcon
                      :name="
                        row.type === 'image'
                          ? 'i-lucide-image'
                          : 'i-lucide-video'
                      "
                      class="size-3"
                    />
                    {{ row.type === "image" ? "Image" : "Video" }}
                  </span>
                </td>
                <td
                  class="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300"
                >
                  {{ row.count.toLocaleString() }}
                </td>
                <td
                  class="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-white"
                >
                  {{ row.total_credits.toLocaleString() }}
                </td>
                <td
                  class="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400"
                >
                  {{ formatUsd(row.total_credits * CREDIT_TO_USD) }}
                </td>
                <td
                  v-if="data.canSeeProviderCost"
                  class="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400"
                >
                  {{ formatUsd(providerCost(row)) }}
                  <span
                    v-if="!row.total_provider_cost"
                    class="text-[10px] text-amber-400/60 dark:text-amber-500/50"
                    title="Estimated from credits (no actual cost recorded)"
                    >est.</span
                  >
                </td>
                <td
                  class="px-4 py-3 text-right text-zinc-400 dark:text-zinc-500 whitespace-nowrap"
                >
                  {{ formatDate(row.last_used) }}
                </td>
              </tr>
            </tbody>
            <!-- Totals footer -->
            <tfoot>
              <tr
                class="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 font-medium"
              >
                <td class="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  Total
                </td>
                <td class="px-4 py-3" />
                <td
                  class="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300"
                >
                  {{ filteredCount.toLocaleString() }}
                </td>
                <td
                  class="px-4 py-3 text-right tabular-nums text-zinc-900 dark:text-white"
                >
                  {{ filteredCredits.toLocaleString() }}
                </td>
                <td
                  class="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400"
                >
                  {{ formatUsd(filteredCredits * CREDIT_TO_USD) }}
                </td>
                <td
                  v-if="data.canSeeProviderCost"
                  class="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400"
                >
                  {{
                    formatUsd(
                      filteredModels.reduce((s, m) => s + providerCost(m), 0),
                    )
                  }}
                </td>
                <td class="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Pricing note -->
      <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-3 text-center">
        Estimated spend is based on the Lumiar credit rate of ${{
          CREDIT_TO_USD
        }}/credit. Actual charges may vary.
      </p>
    </template>
  </div>
</template>
