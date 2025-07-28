export type MenuItem = {
  id: number;
  parent_id: number | null;
  name: string;
  link: string | null;
  icon: string | null;
  position: number;
  required_permission: string | null;
  children?: MenuItem[];
};