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
          is_admin: boolean;
          referral_code: string | null;
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
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          created_at: string;
          credits_awarded_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["referrals"]["Row"],
          "id" | "created_at"
        >;
        Update: Pick<
          Database["public"]["Tables"]["referrals"]["Row"],
          "credits_awarded_at"
        >;
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
      landing_page_examples: {
        Row: {
          id: string;
          use_case_slug: string;
          image_url: string;
          caption: string | null;
          link_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["landing_page_examples"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { is_active?: boolean; sort_order?: number };
        Update: Partial<
          Database["public"]["Tables"]["landing_page_examples"]["Row"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
