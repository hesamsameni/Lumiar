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
        <div class="px-4 py-5 sm:px-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-zinc-900 dark:text-white flex items-center gap-2">
            <UIcon
              :name="icon"
              class="size-5"
              :class="{
                'text-red-500': confirmColor === 'error',
                'text-primary': confirmColor === 'primary',
                'text-zinc-500': confirmColor === 'neutral',
              }"
            />
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
            @click="handleConfirm"
          >
            {{ confirmText }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
