export type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  created_by: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  attendees: {
    profiles: {
      id: string;
      first_name: string | null;
      last_name: string | null;
    } | null;
  }[];
};

export type Birthday = {
  name: string;
  day: number;
};

export type DayData = {
  date: Date;
  events: CalendarEvent[];
  birthdays: Birthday[];
};