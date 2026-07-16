// Shared media types so Explore/Profile can render a mixed image + video feed
// while keeping images and videos as distinct underlying shapes.

export type MediaType = "image" | "video";

export interface ImageGeneration {
  id: string;
  user_id?: string;
  output_image_url: string;
  prompt: string;
  model_name: string;
  created_at: string;
  is_shared?: boolean;
  aspect_ratio?: string;
  quality?: string | null;
  metadata?: { tags?: string[] } | null;
  profiles?: { username: string; avatar_url?: string | null };
  likes?: { id: string }[];
  _count?: { likes: number; comments: number };
}

export interface VideoGeneration {
  id: string;
  user_id?: string;
  output_video_url: string | null;
  thumbnail_url: string | null;
  status?: "pending" | "processing" | "completed" | "failed";
  duration_seconds: number;
  resolution?: string;
  prompt: string;
  model_name: string;
  created_at: string;
  is_shared?: boolean;
  aspect_ratio?: string;
  metadata?: { tags?: string[] } | null;
  profiles?: { username: string; avatar_url?: string | null };
  likes?: { id: string }[];
  _count?: { likes: number; comments: number };
}

// Discriminated union used by the mixed feed. A `media_type` discriminator
// lets a thin `MediaCard` pick the right card component.
export type MediaItem =
  | ({ media_type: "image" } & ImageGeneration)
  | ({ media_type: "video" } & VideoGeneration);

export function isVideoItem(
  item: MediaItem,
): item is { media_type: "video" } & VideoGeneration {
  return item.media_type === "video";
}
