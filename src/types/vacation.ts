export type VacationPeriod = {
  start: string;
  end: string;
};

export type UserVacations = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  vacations: VacationPeriod[];
};

export type VacationRequest = {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};