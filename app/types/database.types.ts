export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          token_balance: number;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      generations: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          model_id: string;
          model_name: string;
          input_image_url: string | null;
          output_image_url: string;
          tokens_used: number;
          aspect_ratio: string;
          parent_id: string | null;
          is_shared: boolean;
          metadata: { tags?: string[] } | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["generations"]["Row"],
          "id" | "created_at" | "is_shared"
        > & { is_shared?: boolean };
        Update: Partial<Database["public"]["Tables"]["generations"]["Row"]>;
      };
      likes: {
        Row: {
          id: string;
          generation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: { generation_id: string; user_id: string };
        Update: never;
      };
      comments: {
        Row: {
          id: string;
          generation_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: { generation_id: string; user_id: string; content: string };
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>;
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: { follower_id: string; following_id: string };
        Update: never;
      };
      token_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: string;
          reference_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["token_transactions"]["Row"],
          "id" | "created_at"
        >;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
