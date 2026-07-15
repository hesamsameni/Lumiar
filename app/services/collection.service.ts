export interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  created_at: string;
}

export interface CollectionWithCount extends CollectionRow {
  collection_items: { generation_id: string | null; video_generation_id?: string | null }[];
}

export type CollectionMediaType = "image" | "video";

function mediaColumn(mediaType: CollectionMediaType) {
  return mediaType === "video" ? "video_generation_id" : "generation_id";
}

export function useCollectionService() {
  const supabase = useSupabaseClient();

  async function getCollectionsByUser(userId: string, onlyPublic = false) {
    let query = (supabase.from("collections") as any)
      .select(
        "id, name, description, cover_image_url, is_public, created_at, collection_items(generation_id, video_generation_id)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (onlyPublic) query = query.eq("is_public", true);
    return query;
  }

  async function getCollectionById(id: string) {
    return (supabase.from("collections") as any)
      .select(
        "id, name, description, cover_image_url, is_public, created_at, user_id",
      )
      .eq("id", id)
      .single();
  }

  async function createCollection(payload: {
    user_id: string;
    name: string;
    description?: string | null;
    is_public?: boolean;
  }) {
    return (supabase.from("collections") as any)
      .insert({
        user_id: payload.user_id,
        name: payload.name,
        description: payload.description ?? null,
        is_public: payload.is_public ?? false,
      })
      .select("id, name, description, cover_image_url, is_public, created_at")
      .single();
  }

  async function deleteCollection(id: string) {
    return (supabase.from("collections") as any).delete().eq("id", id);
  }

  async function getCollectionItems(collectionId: string) {
    return (supabase.from("collection_items") as any)
      .select(
        "generation_id, video_generation_id, added_at, generations(id, output_image_url, prompt, model_name, created_at, metadata, likes(id), is_shared, aspect_ratio), video_generations(id, output_video_url, thumbnail_url, prompt, model_name, created_at, metadata, is_shared, aspect_ratio, duration_seconds, resolution, status)",
      )
      .eq("collection_id", collectionId)
      .order("added_at", { ascending: false });
  }

  async function getCollectionsForGeneration(
    mediaId: string,
    mediaType: CollectionMediaType = "image",
  ) {
    return (supabase.from("collection_items") as any)
      .select("collection_id")
      .eq(mediaColumn(mediaType), mediaId);
  }

  async function addToCollection(
    collectionId: string,
    mediaId: string,
    imageUrl?: string,
    mediaType: CollectionMediaType = "image",
  ) {
    const col = mediaColumn(mediaType);
    const result = await (supabase.from("collection_items") as any).upsert(
      { collection_id: collectionId, [col]: mediaId },
      { onConflict: `collection_id,${col}`, ignoreDuplicates: true },
    );

    if (!result.error && imageUrl) {
      await (supabase.from("collections") as any)
        .update({ cover_image_url: imageUrl })
        .eq("id", collectionId)
        .is("cover_image_url", null);
    }

    return result;
  }

  async function removeFromCollection(
    collectionId: string,
    mediaId: string,
    mediaType: CollectionMediaType = "image",
  ) {
    return (supabase.from("collection_items") as any)
      .delete()
      .eq("collection_id", collectionId)
      .eq(mediaColumn(mediaType), mediaId);
  }

  return {
    getCollectionsByUser,
    getCollectionById,
    createCollection,
    deleteCollection,
    getCollectionItems,
    getCollectionsForGeneration,
    addToCollection,
    removeFromCollection,
  };
}
