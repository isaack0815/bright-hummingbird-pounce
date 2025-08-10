import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Spinner } from 'react-bootstrap';
import { DayPicker, DayModifiers } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { de } from 'date-fns/locale';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EditRosterDayDialog } from './EditRosterDayDialog';

const fetchRosterDetailsForMonth = async (workGroupId: number, year: number, month: number) => {
  const { data, error } = await supabase.functions.invoke('get-roster-details-for-month', {
    body: { workGroupId, year, month },
  });
  if (error) throw error;
  return data;
};

// German holidays for 2024 (nationwide)
const holidays2024 = [
  new Date(2024, 0, 1),  // New Year's Day
  new Date(2024, 2, 29), // Good Friday
  new Date(2024, 3, 1),  // Easter Monday
  new Date(2024, 4, 1),  // Labour Day
  new Date(2024, 4, 9),  // Ascension Day
  new Date(2024, 4, 20), // Whit Monday
  new Date(2024, 9, 3),  // Day of German Unity
  new Date(2024, 11, 25),// Christmas Day
  new Date(2024, 11, 26),// 2nd Day of Christmas
];

type RosterEntry = {
  id: number;
  duty_date: string;
  user_id: string;
  tour_id: number | null;
  roster_id: number;
  profiles: { first_name: string | null; last_name: string | null };
  tours: { name: string } | null;
};

type Member = { id: string; first_name: string | null; last_name: string | null };

export const RosterCalendar = ({ workGroupId, currentMonth, onMonthChange, rosterId }: { workGroupId: number, currentMonth: Date, onMonthChange: (date: Date) => void, rosterId: number | null }) => {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rosterDetailsForMonth', workGroupId, currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: () => fetchRosterDetailsForMonth(workGroupId, currentMonth.getFullYear(), currentMonth.getMonth()),
  });

  const { entriesByDay, members } = useMemo(() => {
    const map = new Map<string, RosterEntry[]>();
    if (data?.entries) {
      for (const entry of data.entries) {
        const day = entry.duty_date;
        if (!map.has(day)) {
          map.set(day, []);
        }
        map.get(day)!.push(entry);
      }
    }
    const members = data?.members || [];
    return { entriesByDay: map, members };
  }, [data]);

  const initialAssignmentsForSelectedDay = useMemo(() => {
    const assignments: Record<string, number | null> = {};
    if (selectedDay && members) {
        const dayEntries = entriesByDay.get(format(selectedDay, 'yyyy-MM-dd')) || [];
        members.forEach((member: Member) => {
            const assignment = dayEntries.find(e => e.user_id === member.id);
            assignments[member.id] = assignment?.tour_id || null;
        });
    }
    return assignments;
  }, [selectedDay, members, entriesByDay]);

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setIsModalOpen(true);
  };

  const DayContent = (props: { date: Date }) => {
    const dateString = format(props.date, 'yyyy-MM-dd');
    const dayEntries = entriesByDay.get(dateString);

    return (
      <div className="d-flex flex-column p-1 h-100 position-relative">
        <div className="text-end">{props.date.getDate()}</div>
        <div className="flex-grow-1 small" style={{overflowY: 'auto', maxHeight: '70px'}}>
          {dayEntries?.map(entry => (
            <div key={entry.id} className="mb-1">
              <div className="btn btn-primary btn-sm w-100 text-start text-truncate" style={{ pointerEvents: 'none' }}>
                {entry.profiles.first_name?.charAt(0)}. {entry.profiles.last_name}: {entry.tours?.name || 'Frei'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const modifiers: DayModifiers = {
    weekends: { dayOfWeek: [0, 6] },
    holidays: holidays2024,
  };

  const modifiersClassNames = {
    weekends: 'day-weekend',
    holidays: 'day-holiday',
  };

  return (
    <>
      <Card>
        <Card.Body>
          {isLoading && <div className="text-center"><Spinner /></div>}
          <style>{`
            .rdp { width: 100%; }
            .rdp-day { height: 120px; align-items: flex-start; }
            .rdp-caption_label { font-weight: bold; }
            .rdp-day_selected { background-color: var(--bs-primary-bg-subtle) !important; }
            .day-weekend { color: var(--bs-danger); }
            .day-holiday { background-color: var(--bs-warning-bg-subtle); }
          `}</style>
          <DayPicker
            locale={de}
            month={currentMonth}
            onMonthChange={onMonthChange}
            showOutsideDays
            onDayClick={handleDayClick}
            classNames={{
              table: 'table table-bordered',
              head_cell: 'text-center',
            }}
            components={{
              DayContent: DayContent,
              IconLeft: () => <ChevronLeft size={16} />,
              IconRight: () => <ChevronRight size={16} />,
            }}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            formatters={{
              formatCaption: (date) => format(date, 'MMMM yyyy', { locale: de }),
            }}
          />
        </Card.Body>
      </Card>
      <EditRosterDayDialog
        show={isModalOpen}
        onHide={() => setIsModalOpen(false)}
        date={selectedDay}
        rosterId={rosterId}
        members={members}
        initialAssignments={initialAssignmentsForSelectedDay}
      />
    </>
  );
};