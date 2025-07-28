export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type ChatMessage = {
  id: number;
  user_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  profiles: Profile | null;
};