import { Table, Button, Badge } from 'react-bootstrap';
import { Edit, Trash2 } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
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
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const WorkTimeHistory = ({ sessions, onEdit, onDelete }: WorkTimeHistoryProps) => {
  return (
    <Table responsive hover>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Start</th>
          <th>Ende</th>
          <th>Pause</th>
          <th>Dauer</th>
          <th>Notizen</th>
          <th className="text-end">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map(session => {
          const start = new Date(session.start_time);
          const end = session.end_time ? new Date(session.end_time) : null;
          const totalMinutes = end ? differenceInMinutes(end, start) : 0;
          const workMinutes = totalMinutes - (session.break_duration_minutes || 0);

          return (
            <tr key={session.id}>
              <td>{format(start, 'dd.MM.yyyy')}</td>
              <td>{format(start, 'HH:mm')}</td>
              <td>{end ? format(end, 'HH:mm') : <Badge bg="info">Aktiv</Badge>}</td>
              <td>{session.break_duration_minutes} min</td>
              <td className="fw-bold">{formatDuration(workMinutes)}</td>
              <td>{session.notes}</td>
              <td className="text-end">
                <Button variant="ghost" size="sm" onClick={() => onEdit(session)}><Edit size={16} /></Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => onDelete(session.id)}><Trash2 size={16} /></Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};