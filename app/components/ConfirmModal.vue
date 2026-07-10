<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: "primary" | "error" | "neutral" | "success" | "warning" | "info";
    loading?: boolean;
    icon?: string;
  }>(),
  {
    confirmText: "Confirm",
    cancelText: "Cancel",
    confirmColor: "primary",
    loading: false,
    icon: "i-lucide-alert-circle",
  },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [];
  cancel: [];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit("update:open", value),
});

function handleConfirm() {
  emit("confirm");
}

function handleCancel() {
  emit("cancel");
  isOpen.value = false;
}
</script>

<template>
  <UModal v-model:open="isOpen" :dismissible="!loading">
    <template #content>
      <div>
        <div class="relative px-4 py-4 sm:px-6 flex items-center justify-between">
          <h3 class="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span
              class="flex size-9 items-center justify-center rounded-xl ring-1 flex-shrink-0"
              :class="
                confirmColor === 'error'
                  ? 'bg-red-500/10 text-red-500 ring-red-500/15'
                  : 'bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 text-primary ring-primary/15'
              "
            >
              <UIcon :name="icon" class="size-[18px]" />
            </span>
            {{ title }}
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="-my-1"
            :disabled="loading"
            @click="handleCancel"
          />
          <div
            class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />
        </div>

        <div class="px-4 py-5 sm:p-6">
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            {{ description }}
          </p>
        </div>

        <div class="px-4 py-4 sm:px-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="loading"
            @click="handleCancel"
          >
            {{ cancelText }}
          </UButton>
          <UButton
            :color="confirmColor"
            :loading="loading"
            :class="
              confirmColor === 'primary'
                ? '!bg-gradient-brand !text-white shadow-glow-brand hover:!brightness-110 transition-all'
                : ''
            "
            @click="handleConfirm"
          >
            {{ confirmText }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
