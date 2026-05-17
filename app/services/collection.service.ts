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
  collection_items: { generation_id: string }[];
}

export function useCollectionService() {
  const supabase = useSupabaseClient();

  async function getCollectionsByUser(userId: string, onlyPublic = false) {
    let query = (supabase.from("collections") as any)
      .select(
        "id, name, description, cover_image_url, is_public, created_at, collection_items(generation_id)",
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
        "generation_id, added_at, generations(id, output_image_url, prompt, model_name, created_at, metadata, likes(id), is_shared)",
      )
      .eq("collection_id", collectionId)
      .order("added_at", { ascending: false });
  }

  async function getCollectionsForGeneration(generationId: string) {
    return (supabase.from("collection_items") as any)
      .select("collection_id")
      .eq("generation_id", generationId);
  }

  async function addToCollection(
    collectionId: string,
    generationId: string,
    imageUrl?: string,
  ) {
    const result = await (supabase.from("collection_items") as any).insert({
      collection_id: collectionId,
      generation_id: generationId,
    });

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
    generationId: string,
  ) {
    return (supabase.from("collection_items") as any)
      .delete()
      .eq("collection_id", collectionId)
      .eq("generation_id", generationId);
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
