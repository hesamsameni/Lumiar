export interface GenerationListItem {
  id: string;
  user_id: string;
  output_image_url: string;
  prompt: string;
  model_name: string;
  created_at: string;
  metadata: { tags?: string[] } | null;
  likes?: { id: string }[];
  is_shared?: boolean;
}

export function useGenerationService() {
  const supabase = useSupabaseClient();

  async function getGenerationForEdit(id: string) {
    return supabase
      .from("generations")
      .select("output_image_url, prompt")
      .eq("id", id)
      .single();
  }

  async function createGeneration(payload: {
    user_id: string;
    prompt: string;
    model_id: string;
    model_name: string;
    input_image_url: string | null;
    output_image_url: string;
    tokens_used: number;
    aspect_ratio: string;
    parent_id: string | null;
    metadata: { tags?: string[] };
  }) {
    return supabase
      .from("generations")
      .insert(payload as never)
      .select("id")
      .single();
  }

  async function getGenerationById(id: string) {
    return supabase.from("generations").select("*").eq("id", id).single();
  }

  async function getGenerationsByUser(userId: string, onlyShared = false) {
    let query = supabase
      .from("generations")
      .select(
        "id, output_image_url, prompt, model_name, created_at, metadata, likes(id), is_shared, aspect_ratio, quality",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (onlyShared) {
      query = query.eq("is_shared", true);
    }

    return query;
  }

  async function getExploreGenerations(params: {
    page: number;
    pageSize: number;
    selectedTag: string | null;
    searchQuery: string;
  }) {
    const { page, pageSize, selectedTag, searchQuery } = params;

    let query = supabase
      .from("generations")
      .select(
        "id, user_id, output_image_url, prompt, model_name, created_at, metadata, likes(id), aspect_ratio, quality",
      )
      .eq("is_shared", true)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (selectedTag) {
      query = query.contains("metadata", { tags: [selectedTag] });
    }

    if (searchQuery.trim()) {
      query = query.ilike("prompt", `%${searchQuery.trim()}%`);
    }

    return query;
  }

  async function getGenerationShareState(generationId: string) {
    return supabase
      .from("generations")
      .select("is_shared")
      .eq("id", generationId)
      .single();
  }

  async function setGenerationShared(generationId: string, isShared: boolean) {
    return supabase
      .from("generations")
      .update({ is_shared: isShared } as never)
      .eq("id", generationId);
  }

  return {
    getGenerationForEdit,
    createGeneration,
    getGenerationById,
    getGenerationsByUser,
    getExploreGenerations,
    getGenerationShareState,
    setGenerationShared,
  };
}
