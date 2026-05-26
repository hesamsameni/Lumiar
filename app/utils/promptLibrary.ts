export interface PromptPlaceholder {
  key: string;
  label: string;
  hint?: string;
  default?: string;
  options?: string[];
}

export interface PromptItem {
  id: string;
  category_id: string;
  title: string;
  prompt: string;
  image_urls: string[];
  placeholders: PromptPlaceholder[];
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PromptCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  prompts: PromptItem[];
}

export interface PromptCard {
  cardId: string;
  promptId: string;
  title: string;
  prompt: string;
  image: string | null;
  category: PromptCategory;
  placeholders: PromptPlaceholder[];
}
