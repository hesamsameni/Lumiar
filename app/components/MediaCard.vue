<script setup lang="ts">
import type { MediaItem } from "~/types/media.types";

const props = defineProps<{
  item: MediaItem;
  showAuthor?: boolean;
  isOwner?: boolean;
  masonry?: boolean;
  initialIsLiked?: boolean;
  collectionId?: string;
  fill?: boolean;
}>();

const emit = defineEmits<{
  deleted: [id: string];
  shareToggled: [id: string, isShared: boolean];
  removedFromCollection: [id: string];
  preview: [id: string];
}>();

// Route by media_type, but also fall back to the presence of the video-only
// field so a video can never render as an image card if the tag is missing.
const isVideo = computed(
  () =>
    props.item.media_type === "video" || "output_video_url" in props.item,
);
</script>

<template>
  <VideoCard
    v-if="isVideo"
    :generation="(item as never)"
    :show-author="showAuthor"
    :is-owner="isOwner"
    :masonry="masonry"
    :initial-is-liked="initialIsLiked"
    :collection-id="collectionId"
    :fill="fill"
    @deleted="emit('deleted', $event)"
    @removed-from-collection="emit('removedFromCollection', $event)"
    @preview="emit('preview', $event)"
  />
  <GenerationCard
    v-else
    :generation="item as never"
    :show-author="showAuthor"
    :is-owner="isOwner"
    :masonry="masonry"
    :initial-is-liked="initialIsLiked"
    :collection-id="collectionId"
    :fill="fill"
    @deleted="emit('deleted', $event)"
    @share-toggled="(id, s) => emit('shareToggled', id, s)"
    @removed-from-collection="emit('removedFromCollection', $event)"
    @preview="emit('preview', $event)"
  />
</template>
