export function useVideoGenerationService() {
  const supabase = useSupabaseClient();

  async function getVideoById(id: string) {
    return supabase.from("video_generations").select("*").eq("id", id).single();
  }

  // Owners see all their in-flight + finished videos (so a clip appears while
  // it's still generating); visitors only ever see completed, shared clips.
  async function getVideosByUser(userId: string, onlyShared = false) {
    let query = supabase
      .from("video_generations")
      .select(
        "id, user_id, output_video_url, thumbnail_url, prompt, model_name, created_at, metadata, is_shared, aspect_ratio, duration_seconds, resolution, status",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (onlyShared) {
      query = query.eq("is_shared", true).eq("status", "completed");
    } else {
      query = query.neq("status", "failed");
    }

    return query;
  }

  async function getExploreVideos(params: {
    page: number;
    pageSize: number;
    selectedTag: string | null;
    searchQuery: string;
  }) {
    const { page, pageSize, selectedTag, searchQuery } = params;

    let query = supabase
      .from("video_generations")
      .select(
        "id, user_id, output_video_url, thumbnail_url, prompt, model_name, created_at, metadata, aspect_ratio, duration_seconds, resolution",
      )
      .eq("is_shared", true)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (selectedTag) query = query.contains("metadata", { tags: [selectedTag] });
    if (searchQuery.trim())
      query = query.ilike("prompt", `%${searchQuery.trim()}%`);

    return query;
  }

  async function getVideoShareState(id: string) {
    return supabase
      .from("video_generations")
      .select("is_shared")
      .eq("id", id)
      .single();
  }

  async function setVideoShared(id: string, isShared: boolean) {
    return supabase
      .from("video_generations")
      .update({ is_shared: isShared } as never)
      .eq("id", id);
  }

  return {
    getVideoById,
    getVideosByUser,
    getExploreVideos,
    getVideoShareState,
    setVideoShared,
  };
}
