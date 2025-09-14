export type UserFolder = {
  id: number;
  user_id: string;
  parent_folder_id: number | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type UserFile = {
  id: number;
  user_id: string;
  folder_id: number | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
};