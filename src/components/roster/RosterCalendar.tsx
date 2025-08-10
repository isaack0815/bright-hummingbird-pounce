import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Badge } from 'react-bootstrap';
import { DayPicker } from 'react-day-picker';
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

export const RosterCalendar = ({ workGroupId }: { workGroupId: number }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['rosterDetailsForMonth', workGroupId, currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: () => fetchRosterDetailsForMonth(workGroupId, currentMonth.getFullYear(), currentMonth.getMonth()),
  });

  const { entriesByDay, members, rosterIdForSelectedDay } = useMemo(() => {
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
    let rosterId = null;
    if (selectedDay) {
        const dayEntries = map.get(format(selectedDay, 'yyyy-MM-dd'));
        if (dayEntries && dayEntries.length > 0) {
            rosterId = dayEntries[0].roster_id;
        } else {
            // If no entries, find a roster that covers this day
            const { data: roster } = {data: null} // This part is complex, for now we can only edit days with existing entries
        }
    }
    return { entriesByDay: map, members, rosterIdForSelectedDay: rosterId };
  }, [data, selectedDay]);

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
              <Badge bg="primary" className="w-100 text-start text-truncate">
                {entry.profiles.first_name?.charAt(0)}. {entry.profiles.last_name}: {entry.tours?.name || 'Frei'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <Card.Body>
          {isLoading && <div className="text-center"><Spinner /></div>}
          <style>{`
            .rdp-day { height: 120px; align-items: flex-start; }
            .rdp-caption_label { font-weight: bold; }
            .rdp-day_selected { background-color: var(--bs-primary-bg-subtle) !important; }
          `}</style>
          <DayPicker
            locale={de}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays
            onDayClick={handleDayClick}
            components={{
              DayContent: DayContent,
              IconLeft: () => <ChevronLeft size={16} />,
              IconRight: () => <ChevronRight size={16} />,
            }}
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
        rosterId={rosterIdForSelectedDay}
        members={members}
        initialAssignments={initialAssignmentsForSelectedDay}
      />
    </>
  );
};