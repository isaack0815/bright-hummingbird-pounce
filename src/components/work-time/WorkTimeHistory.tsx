import { Table, Button, Badge } from 'react-bootstrap';
import { Edit, Trash2 } from 'lucide-react';
import { format, differenceInMinutes, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend } from 'date-fns';
import { de } from 'date-fns/locale';

type WorkSession = {
  id: number;
  start_time: string;
  end_time: string | null;
  break_duration_minutes: number;
  notes: string | null;
};

type WorkTimeHistoryProps = {
  sessions: WorkSession[];
  onEdit: (session: WorkSession) => void;
  onDelete: (id: number) => void;
  month: Date;
  targetHoursPerWeek: number | null;
};

const formatDuration = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '';
  const absMinutes = Math.abs(minutes);
  const h = Math.floor(absMinutes / 60);
  const m = Math.round(absMinutes % 60);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const WorkTimeHistory = ({ sessions, onEdit, onDelete, month, targetHoursPerWeek }: WorkTimeHistoryProps) => {
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const sessionsByDate = sessions.reduce((acc, session) => {
    const dateKey = format(new Date(session.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, WorkSession[]>);

  const dailyTargetMinutes = targetHoursPerWeek ? (targetHoursPerWeek / 5) * 60 : 0;

  return (
    <Table responsive hover>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Start</th>
          <th>Ende</th>
          <th>Pause</th>
          <th>Soll</th>
          <th>Ist</th>
          <th>Saldo</th>
          <th>Notizen</th>
          <th className="text-end">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        {daysInMonth.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const sessionsForDay = sessionsByDate[dateKey] || [];
          const isWeekendDay = isWeekend(day);
          const targetMinutes = isWeekendDay ? 0 : dailyTargetMinutes;

          if (sessionsForDay.length === 0) {
            return (
              <tr key={dateKey} className={isWeekendDay ? 'table-info' : ''}>
                <td>{format(day, 'dd.MM.yyyy (E)', { locale: de })}</td>
                <td colSpan={5} className="text-muted"></td>
                <td>{formatDuration(0 - targetMinutes)}</td>
                <td colSpan={2}></td>
              </tr>
            );
          }

          return sessionsForDay.map((session, index) => {
            const start = new Date(session.start_time);
            const end = session.end_time ? new Date(session.end_time) : null;
            const totalMinutes = end ? differenceInMinutes(end, start) : 0;
            const workMinutes = totalMinutes - (session.break_duration_minutes || 0);
            const deltaMinutes = workMinutes - (index === 0 ? targetMinutes : 0); // Saldo nur beim ersten Eintrag des Tages berechnen

            return (
              <tr key={session.id} className={isWeekendDay ? 'table-info' : ''}>
                <td>{index === 0 ? format(day, 'dd.MM.yyyy (E)', { locale: de }) : ''}</td>
                <td>{format(start, 'HH:mm')}</td>
                <td>{end ? format(end, 'HH:mm') : <Badge bg="info">Aktiv</Badge>}</td>
                <td>{session.break_duration_minutes} min</td>
                <td>{index === 0 ? formatDuration(targetMinutes) : ''}</td>
                <td className="fw-bold">{formatDuration(workMinutes)}</td>
                <td className={deltaMinutes >= 0 ? 'text-success' : 'text-danger'}>{formatDuration(deltaMinutes)}</td>
                <td>{session.notes}</td>
                <td className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(session)}><Edit size={16} /></Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => onDelete(session.id)}><Trash2 size={16} /></Button>
                </td>
              </tr>
            );
          });
        })}
      </tbody>
    </Table>
  );
};