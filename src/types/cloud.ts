export type CloudFolder = {
  id: number;
  name: string;
  parent_folder_id: number | null;
  created_at: string;
  created_by: string;
};

export type CloudFile = {
  id: number;
  name: string;
  folder_id: number | null;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  created_by: string;
};