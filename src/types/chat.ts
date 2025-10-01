export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type ChatMessage = {
  id: number;
  user_id: string;
  conversation_id: number;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  profiles: Profile | null;
};

export type Conversation = {
  conversation_id: number;
  other_user_id: string;
  other_user_first_name: string | null;
  other_user_last_name: string | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
};

export type ChatUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};