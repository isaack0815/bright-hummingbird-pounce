import { useState, useMemo } from 'react';
import { Card, Button, Spinner, ListGroup, Row, Col } from 'react-bootstrap';
import { PlusCircle, ChevronLeft, ChevronRight, Trash2, Users, Cake } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { de } from 'date-fns/locale';
import { format } from 'date-fns';
import { AddEventDialog } from './AddEventDialog';
import type { CalendarEvent, Birthday } from '@/types/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';

const fetchCalendarData = async (month: number, year: number): Promise<{ events: CalendarEvent[], birthdays: Birthday[] }> => {
  const { data, error } = await supabase.functions.invoke('get-calendar-events', {
    body: { month, year },
  });
  if (error) throw error;
  return data;
};

const DayDetails = ({ date, data, onDelete }: { date: Date, data?: { events: CalendarEvent[], birthdays: Birthday[] }, onDelete: (id: number) => void }) => {
  const { user } = useAuth();
  return (
    <div className="ps-3 border-start h-100">
      <h6 className="mb-3">Einträge für den {format(date, 'd. MMMM yyyy', { locale: de })}</h6>
      {!data || (data.events.length === 0 && data.birthdays.length === 0) ? (
        <p className="text-muted small">Keine Einträge für diesen Tag.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {data.birthdays.map((b, i) => (
            <div key={`b-${i}`} className="d-flex align-items-center small"><Cake size={16} className="me-2 text-warning flex-shrink-0" />{b.name} hat Geburtstag!</div>
          ))}
          {data.events.map(event => (
            <div key={event.id}>
              <div className="d-flex justify-content-between align-items-start">
                <p className="fw-bold small mb-0">{event.title}</p>
                {event.created_by === user?.id && (
                  <Button variant="ghost" size="sm" className="p-0 text-danger" onClick={() => onDelete(event.id)}><Trash2 size={14} /></Button>
                )}
              </div>
              <p className="small text-muted mb-1">{format(new Date(event.start_time), 'HH:mm')} Uhr</p>
              {event.description && <p className="small mb-1">{event.description}</p>}
              {event.attendees.length > 0 && (
                <div className="d-flex align-items-center small text-muted">
                  <Users size={14} className="me-1" />
                  {event.attendees.map(a => a.profiles?.first_name).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function CalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', currentMonth.getFullYear(), currentMonth.getMonth()] });
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

  return (
    <>
      <Card className="h-100">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <Card.Title as="h6" className="mb-0">Kalender</Card.Title>
          <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle size={16} />
          </Button>
        </Card.Header>
        <Card.Body>
          {isLoading ? <div className="text-center"><Spinner size="sm" /></div> : (
            <Row>
              <Col md={7}>
                <DayPicker
                  locale={de}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  selected={selectedDate}
                  onDayClick={setSelectedDate}
                  showOutsideDays
                  components={{
                    DayContent: DayContent,
                    IconLeft: () => <ChevronLeft size={16} />,
                    IconRight: () => <ChevronRight size={16} />,
                  }}
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
              </Col>
              <Col md={5}>
                <DayDetails 
                  date={selectedDate} 
                  data={eventsByDay.get(selectedDate.getDate())}
                  onDelete={deleteMutation.mutate}
                />
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>
      <AddEventDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} selectedDate={selectedDate} />
    </>
  );
}