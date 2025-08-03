export type Todo = {
  id: number;
  created_at: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  created_by: string;
  assigned_to: string;
  is_completed: boolean;
  completed_at: string | null;
  creator_first_name: string | null;
  creator_last_name: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
};