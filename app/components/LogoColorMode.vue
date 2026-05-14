<template>
  <img
    :src="src"
    :alt="alt"
    class="size-6 object-contain"
    :style="computedStyle"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string;
  alt: string;
}>();

const colorMode = useColorMode ? useColorMode() : null;

const computedStyle = computed(() => {
  // If SVG, use filter to invert for dark mode, else fallback to default
  if (props.src.endsWith(".svg")) {
    return colorMode && colorMode.value === "dark"
      ? "filter: invert(1) brightness(2);"
      : "";
  }
  return "";
});
</script>
