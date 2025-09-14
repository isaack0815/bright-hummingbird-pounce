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