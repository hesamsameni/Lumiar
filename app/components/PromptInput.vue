<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const supabase = useSupabaseClient();
const toast = useToast();
const isPolishing = ref(false);

async function polishPrompt() {
  if (!props.modelValue.trim()) {
    toast.add({ title: "Write a prompt first", color: "warning" });
    return;
  }
  isPolishing.value = true;
  try {
    // Always get a fresh token — do not rely on a potentially stale reactive ref
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const { polished } = await $fetch<{ polished: string }>(
      "/api/polish-prompt",
      {
        method: "POST",
        body: { prompt: props.modelValue },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    );
    emit("update:modelValue", polished);
    toast.add({
      title: "Prompt polished!",
      description: "AI has enhanced your prompt.",
      color: "success",
    });
  } catch {
    toast.add({
      title: "Polish failed",
      description: "Could not improve the prompt.",
      color: "error",
    });
  } finally {
    isPolishing.value = false;
  }
}
</script>

<template>
  <div class="space-y-2">
    <UTextarea
      :value="modelValue"
      placeholder="Describe the image you want to generate or edit…"
      :rows="6"
      autoresize
      class="w-full"
      :disabled="disabled"
      @input="
        emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />
    <div class="flex justify-end">
      <UTooltip text="Polish prompt with AI">
        <UButton
          icon="i-lucide-wand-sparkles"
          size="sm"
          variant="soft"
          color="primary"
          :loading="isPolishing"
          :disabled="disabled || !modelValue.trim()"
          @click="polishPrompt"
        >
          Polish with AI
        </UButton>
      </UTooltip>
    </div>
  </div>
</template>
