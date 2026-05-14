export function useSocialService() {
  const supabase = useSupabaseClient()

  async function getLikeByUser(generationId: string, userId: string) {
    return supabase
      .from('likes')
      .select('id')
      .eq('generation_id', generationId)
      .eq('user_id', userId)
      .maybeSingle()
  }

  async function likeGeneration(generationId: string, userId: string) {
    return supabase
      .from('likes')
      .insert({ generation_id: generationId, user_id: userId } as never)
  }

  async function unlikeGeneration(generationId: string, userId: string) {
    return supabase
      .from('likes')
      .delete()
      .eq('generation_id', generationId)
      .eq('user_id', userId)
  }

  async function getLikesCount(generationId: string) {
    return supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('generation_id', generationId)
  }

  async function getFollowByUser(followerId: string, followingId: string) {
    return supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle()
  }

  async function followUser(followerId: string, followingId: string) {
    return supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId } as never)
  }

  async function unfollowUser(followerId: string, followingId: string) {
    return supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
  }

  async function getFollowersCount(profileId: string) {
    return supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId)
  }

  async function getFollowingCount(profileId: string) {
    return supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId)
  }

  async function getCommentsByGeneration(generationId: string) {
    return supabase
      .from('comments')
      .select('*')
      .eq('generation_id', generationId)
      .order('created_at', { ascending: true })
  }

  async function addComment(generationId: string, userId: string, content: string) {
    return supabase
      .from('comments')
      .insert({ generation_id: generationId, user_id: userId, content } as never)
      .select('*')
      .single()
  }

  async function deleteComment(commentId: string) {
    return supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
  }

  return {
    getLikeByUser,
    likeGeneration,
    unlikeGeneration,
    getLikesCount,
    getFollowByUser,
    followUser,
    unfollowUser,
    getFollowersCount,
    getFollowingCount,
    getCommentsByGeneration,
    addComment,
    deleteComment,
  }
}
