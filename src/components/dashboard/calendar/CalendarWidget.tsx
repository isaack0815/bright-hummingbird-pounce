import { useState, useMemo } from 'react';
import { Card, Button, Popover, OverlayTrigger, Badge, Spinner } from 'react-bootstrap';
import { PlusCircle, ChevronLeft, ChevronRight, Trash2, Users, Cake } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { de } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { AddEventDialog } from './AddEventDialog';
import type { CalendarEvent, Birthday, DayData } from '@/types/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';

const fetchCalendarData = async (month: number, year: number): Promise<{ events: CalendarEvent[], birthdays: Birthday[] }> => {
  const { data, error } = await supabase.functions.invoke('get-calendar-events', {
    body: { month, year },
  });
  if (error) throw error;
  return data;
};

export function CalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['calendarEvents', currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: () => fetchCalendarData(currentMonth.getMonth(), currentMonth.getFullYear()),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.functions.invoke('delete-calendar-event', { body: { id } });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Termin gelöscht.");
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Löschen."),
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<number, { events: CalendarEvent[], birthdays: Birthday[] }>();
    data?.events.forEach(event => {
      const day = new Date(event.start_time).getDate();
      if (!map.has(day)) map.set(day, { events: [], birthdays: [] });
      map.get(day)!.events.push(event);
    });
    data?.birthdays.forEach(birthday => {
      const day = birthday.day;
      if (!map.has(day)) map.set(day, { events: [], birthdays: [] });
      map.get(day)!.birthdays.push(birthday);
    });
    return map;
  }, [data]);

  const DayContent = (props: { date: Date }) => {
    const dayData = eventsByDay.get(props.date.getDate());
    const hasEvents = (dayData?.events?.length ?? 0) > 0;
    const hasBirthdays = (dayData?.birthdays?.length ?? 0) > 0;

    return (
      <div className="position-relative">
        {props.date.getDate()}
        {(hasEvents || hasBirthdays) && (
          <div className="d-flex position-absolute bottom-0 start-50 translate-middle-x" style={{ gap: '2px' }}>
            {hasEvents && <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--bs-primary)' }} />}
            {hasBirthdays && <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--bs-warning)' }} />}
          </div>
        )}
      </div>
    );
  };

  const DayPopover = ({ dayData }: { dayData: { events: CalendarEvent[], birthdays: Birthday[] } }) => (
    <Popover id="popover-basic">
      <Popover.Body>
        {dayData.birthdays.map((b, i) => (
          <div key={`b-${i}`} className="d-flex align-items-center small mb-2"><Cake size={14} className="me-2 text-warning" />{b.name} hat Geburtstag!</div>
        ))}
        {dayData.events.map(event => (
          <div key={event.id} className="mb-2 border-bottom pb-2">
            <div className="d-flex justify-content-between align-items-start">
              <p className="fw-bold small mb-0">{event.title}</p>
              {event.created_by === user?.id && (
                <Button variant="ghost" size="sm" className="p-0 text-danger" onClick={() => deleteMutation.mutate(event.id)}><Trash2 size={14} /></Button>
              )}
            </div>
            <p className="small text-muted mb-1">{format(new Date(event.start_time), 'HH:mm')} Uhr</p>
            <p className="small mb-1">{event.description}</p>
            <div className="d-flex align-items-center small text-muted">
              <Users size={14} className="me-1" />
              {event.attendees.map(a => a.profiles?.first_name).join(', ')}
            </div>
          </div>
        ))}
      </Popover.Body>
    </Popover>
  );

  return (
    <>
      <Card className="h-100">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <Card.Title as="h6" className="mb-0">Kalender</Card.Title>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(new Date()); setIsAddDialogOpen(true); }}>
            <PlusCircle size={16} />
          </Button>
        </Card.Header>
        <Card.Body>
          <DayPicker
            locale={de}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays
            components={{
              DayContent: DayContent,
              IconLeft: () => <ChevronLeft size={16} />,
              IconRight: () => <ChevronRight size={16} />,
            }}
            onDayClick={(date) => { setSelectedDate(date); setIsAddDialogOpen(true); }}
            modifiers={{
              withData: Array.from(eventsByDay.keys()).map(day => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)),
            }}
            modifiersClassNames={{
              withData: 'day-with-data',
            }}
            formatters={{
              formatCaption: (date) => format(date, 'MMMM yyyy', { locale: de }),
            }}
          />
        </Card.Body>
      </Card>
      <AddEventDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} selectedDate={selectedDate} />
    </>
  );
}