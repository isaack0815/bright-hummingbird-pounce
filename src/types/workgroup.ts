export type WorkGroupMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type WorkGroup = {
  id: number;
  name: string;
  description: string | null;
  members: WorkGroupMember[];
};