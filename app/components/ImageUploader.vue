<script setup lang="ts">
const props = defineProps<{
  modelValue: File | null
  previewUrl?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
  'update:previewUrl': [url: string | null]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) handleFile(file)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

function handleFile(file: File) {
  emit('update:modelValue', file)
  const reader = new FileReader()
  reader.onload = (e) => emit('update:previewUrl', e.target?.result as string)
  reader.readAsDataURL(file)
}

function clearFile() {
  emit('update:modelValue', null)
  emit('update:previewUrl', null)
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="relative">
    <div
      v-if="!previewUrl"
      class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
      :class="isDragging
        ? 'border-primary bg-primary/5'
        : 'border-zinc-200 dark:border-zinc-700 hover:border-primary/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'"
      @click="fileInput?.click()"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <UIcon name="i-lucide-image-plus" class="size-10 mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
      <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Drop an image here or <span class="text-primary">browse</span>
      </p>
      <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-1">PNG, JPG, WEBP up to 10MB (optional — for image editing)</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileChange"
      />
    </div>

    <div v-else class="relative rounded-xl overflow-hidden group">
      <img :src="previewUrl" alt="Input image" class="w-full max-h-64 object-cover rounded-xl" />
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <UButton icon="i-lucide-x" color="white" variant="solid" size="sm" @click.stop="clearFile">
          Remove image
        </UButton>
      </div>
    </div>
  </div>
</template>
