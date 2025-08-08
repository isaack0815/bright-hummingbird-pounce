export type OrderFileWithDetails = {
  id: number;
  order_id: number;
  user_id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  is_archived: boolean;
  first_name: string | null;
  last_name: string | null;
  order_number: string;
};