<script setup lang="ts">
const { session } = useAuthState();
const toast = useToast();

const authHeaders = computed(() => ({
  Authorization: `Bearer ${session.value?.access_token ?? ""}`,
}));

interface AdminUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  token_balance: number;
  is_admin: boolean;
  generation_count: number;
  created_at: string;
}

const users = ref<AdminUser[]>([]);
const loading = ref(false);
const search = ref("");

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q),
  );
});

async function fetchUsers() {
  loading.value = true;
  try {
    const data = await $fetch<AdminUser[]>("/api/admin/users", {
      headers: authHeaders.value,
    });
    users.value = data ?? [];
  } catch {
    toast.add({ title: "Failed to load users", color: "error" });
  } finally {
    loading.value = false;
  }
}

// ─── Add Credits modal ────────────────────────────────────────────────────────

const showModal = ref(false);
const selectedUser = ref<AdminUser | null>(null);
const creditsToAdd = ref(10);
const saving = ref(false);

function openAddCredits(user: AdminUser) {
  selectedUser.value = user;
  creditsToAdd.value = 10;
  showModal.value = true;
}

async function confirmAddCredits() {
  if (!selectedUser.value) return;
  const amount = Number(creditsToAdd.value);
  if (!Number.isInteger(amount) || amount <= 0) {
    toast.add({ title: "Enter a positive whole number", color: "warning" });
    return;
  }
  saving.value = true;
  try {
    await $fetch(`/api/admin/users/${selectedUser.value.id}`, {
      method: "PATCH",
      headers: authHeaders.value,
      body: { credits: amount },
    });
    toast.add({
      title: `Added ${amount} credits to ${selectedUser.value.username}`,
      color: "success",
    });
    showModal.value = false;
    await fetchUsers();
  } catch (err: unknown) {
    const raw = err as { data?: { message?: string }; message?: string };
    toast.add({
      title: "Failed to add credits",
      description: raw?.data?.message ?? raw?.message,
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

await fetchUsers();
</script>

<template>
  <div>
    <!-- Total users count -->
    <div class="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
      Total users:
      <span class="font-semibold text-zinc-900 dark:text-zinc-100">{{
        users.length
      }}</span>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-5 gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search by username or name…"
        class="max-w-xs"
      />
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        color="neutral"
        size="sm"
        :loading="loading"
        @click="fetchUsers"
      >
        Refresh
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <template v-else>
      <!-- Empty state -->
      <div
        v-if="filteredUsers.length === 0"
        class="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400"
      >
        <UIcon name="i-lucide-users" class="size-10" />
        <p class="text-sm">No users found.</p>
      </div>

      <!-- Table -->
      <div
        v-else
        class="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <table class="w-full text-sm">
          <thead>
            <tr
              class="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"
            >
              <th class="text-left px-4 py-3">User</th>
              <th class="text-center px-4 py-3">Credits</th>
              <th class="text-center px-4 py-3 hidden md:table-cell">
                Generations
              </th>
              <th class="text-center px-4 py-3 hidden lg:table-cell">Role</th>
              <th class="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
            >
              <!-- User info -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <span class="rounded-full p-px bg-conic-brand flex-shrink-0">
                    <UAvatar
                      :src="user.avatar_url ?? undefined"
                      :alt="user.username"
                      size="sm"
                      class="ring-2 ring-white dark:ring-zinc-950"
                    />
                  </span>
                  <div>
                    <p class="font-medium text-zinc-900 dark:text-zinc-100">
                      {{ user.username }}
                    </p>
                    <p
                      v-if="user.full_name"
                      class="text-xs text-zinc-400 dark:text-zinc-500"
                    >
                      {{ user.full_name }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Credits -->
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-flex items-center gap-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200"
                >
                  <UIcon
                    name="i-lucide-coins"
                    class="size-3.5 text-amber-500"
                  />
                  {{ user.token_balance }}
                </span>
              </td>

              <!-- Generations -->
              <td class="px-4 py-3 hidden md:table-cell text-center">
                <span
                  class="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  <UIcon name="i-lucide-image" class="size-3.5" />
                  {{ user.generation_count }}
                </span>
              </td>

              <!-- Role -->
              <td class="px-4 py-3 hidden lg:table-cell text-center">
                <span
                  v-if="user.is_admin"
                  class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-primary/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 text-primary"
                >
                  <UIcon name="i-lucide-shield" class="size-3" />
                  Admin
                </span>
                <span v-else class="text-xs text-zinc-400 dark:text-zinc-500">
                  User
                </span>
              </td>

              <!-- Actions -->
              <td class="px-4 py-3">
                <div class="flex items-center justify-end">
                  <UButton
                    icon="i-lucide-plus-circle"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="openAddCredits(user)"
                  >
                    Add Credits
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Add Credits Modal -->
    <UModal v-model:open="showModal" title="Add Credits">
      <template #body>
        <div class="p-6 space-y-4">
          <div
            v-if="selectedUser"
            class="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900"
          >
            <UAvatar
              :src="selectedUser.avatar_url ?? undefined"
              :alt="selectedUser.username"
              size="sm"
            />
            <div>
              <p class="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                {{ selectedUser.username }}
              </p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                Current balance:
                <span class="font-semibold text-amber-500">
                  {{ selectedUser.token_balance }} credits
                </span>
              </p>
            </div>
          </div>

          <UFormField label="Credits to add">
            <UInput
              v-model.number="creditsToAdd"
              type="number"
              min="1"
              step="1"
              placeholder="10"
              class="w-full"
            />
          </UFormField>

          <p
            v-if="selectedUser && creditsToAdd > 0"
            class="text-xs text-zinc-500 dark:text-zinc-400"
          >
            New balance will be
            <span class="font-semibold text-zinc-700 dark:text-zinc-200">
              {{ selectedUser.token_balance + Number(creditsToAdd) }} credits
            </span>
          </p>
        </div>
      </template>

      <template #footer>
        <div
          class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800"
        >
          <UButton variant="ghost" color="neutral" @click="showModal = false">
            Cancel
          </UButton>
          <UButton
            icon="i-lucide-plus-circle"
            :loading="saving"
            class="!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all"
            @click="confirmAddCredits"
          >
            Add Credits
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
