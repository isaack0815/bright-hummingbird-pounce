import { useState, useMemo } from 'react';
import { PlusCircle, ChevronLeft, ChevronRight, Trash2, Users, Cake, Loader2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

    const content = (
      <div className="relative">
        {props.date.getDate()}
        {(hasEvents || hasBirthdays) && (
          <div className="flex absolute bottom-1 left-1/2 -translate-x-1/2 gap-px">
            {hasEvents && <span className="h-1 w-1 rounded-full bg-primary" />}
            {hasBirthdays && <span className="h-1 w-1 rounded-full bg-yellow-500" />}
          </div>
        )}
      </div>
    );

    if (hasEvents || hasBirthdays) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <div className="w-full h-full flex items-center justify-center">{content}</div>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            {dayData?.birthdays.map((b, i) => (
              <div key={`b-${i}`} className="flex items-center text-sm mb-2"><Cake size={14} className="mr-2 text-yellow-500" />{b.name} hat Geburtstag!</div>
            ))}
            {dayData?.events.map(event => (
              <div key={event.id} className="mb-2 border-b pb-2 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-sm mb-0">{event.title}</p>
                  {event.created_by === user?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(event.id)}><Trash2 size={14} /></Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{format(new Date(event.start_time), 'HH:mm')} Uhr</p>
                <p className="text-sm mb-1">{event.description}</p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users size={14} className="mr-1" />
                  {event.attendees.map(a => a.profiles?.first_name).join(', ')}
                </div>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      );
    }

    return content;
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kalender</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => { setSelectedDate(new Date()); setIsAddDialogOpen(true); }}>
            <PlusCircle className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-grow flex justify-center items-center">
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
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
              formatters={{
                formatCaption: (date) => format(date, 'MMMM yyyy', { locale: de }),
              }}
            />
          )}
        </CardContent>
      </Card>
      <AddEventDialog show={isAddDialogOpen} onHide={() => setIsAddDialogOpen(false)} selectedDate={selectedDate} />
    </>
  );
}