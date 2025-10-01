import { useState } from 'react';
import { Table, Button, Badge, Form } from 'react-bootstrap';
import { Edit, Trash2 } from 'lucide-react';
import { format, differenceInMinutes, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend, parse } from 'date-fns';
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
  onCreate: (date: Date) => void;
  month: Date;
  targetHoursPerWeek: number | null;
  onSave: (id: number, data: Partial<WorkSession>) => void;
};

const formatDuration = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '';
  const absMinutes = Math.abs(minutes);
  const h = Math.floor(absMinutes / 60);
  const m = Math.round(absMinutes % 60);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const editableColumns = ['start_time', 'end_time', 'break_duration_minutes', 'notes'];

export const WorkTimeHistory = ({ sessions, onEdit, onDelete, onCreate, month, targetHoursPerWeek, onSave }: WorkTimeHistoryProps) => {
  const [editingCell, setEditingCell] = useState<{ rowId: number; column: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const sessionsByDate = sessions.reduce((acc, session) => {
    const dateKey = format(new Date(session.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(session);
    return acc;
  }, {} as Record<string, WorkSession[]>);

  const dailyTargetMinutes = targetHoursPerWeek ? (targetHoursPerWeek / 5) * 60 : 0;

  const handleDoubleClick = (session: WorkSession, column: string) => {
    let initialValue = '';
    switch (column) {
      case 'start_time': initialValue = format(new Date(session.start_time), 'HH:mm'); break;
      case 'end_time': initialValue = session.end_time ? format(new Date(session.end_time), 'HH:mm') : ''; break;
      default: initialValue = String((session as any)[column] || '');
    }
    setEditingCell({ rowId: session.id, column });
    setEditValue(initialValue);
  };

  const handleSave = () => {
    if (!editingCell) return;
    const session = sessions.find(s => s.id === editingCell.rowId);
    if (!session) return;

    let updateData: Partial<WorkSession> = {};
    switch (editingCell.column) {
      case 'start_time':
      case 'end_time': {
        const datePart = format(new Date(session.start_time), 'yyyy-MM-dd');
        const newDateTime = parse(`${datePart} ${editValue}`, 'yyyy-MM-dd HH:mm', new Date());
        updateData[editingCell.column] = newDateTime.toISOString();
        break;
      }
      case 'break_duration_minutes':
        updateData[editingCell.column] = Number(editValue);
        break;
      default:
        updateData[editingCell.column as keyof WorkSession] = editValue;
    }
    onSave(editingCell.rowId, updateData);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, session: WorkSession, colIndex: number) => {
    if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSave();
      
      const allSessionsInOrder = daysInMonth.flatMap(day => sessionsByDate[format(day, 'yyyy-MM-dd')] || []);
      const currentRowIndex = allSessionsInOrder.findIndex(s => s.id === session.id);
      
      let nextRowIndex = currentRowIndex;
      let nextColIndex = colIndex + (e.shiftKey ? -1 : 1);

      if (nextColIndex >= editableColumns.length) {
        nextColIndex = 0;
        nextRowIndex++;
      } else if (nextColIndex < 0) {
        nextColIndex = editableColumns.length - 1;
        nextRowIndex--;
      }

      if (nextRowIndex >= 0 && nextRowIndex < allSessionsInOrder.length) {
        const nextSession = allSessionsInOrder[nextRowIndex];
        const nextColumn = editableColumns[nextColIndex];
        handleDoubleClick(nextSession, nextColumn);
      }
    }
  };

  const renderCell = (session: WorkSession, column: string, colIndex: number) => {
    if (editingCell?.rowId === session.id && editingCell?.column === column) {
      return (
        <Form.Control
          size="sm"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => handleKeyDown(e, session, colIndex)}
          autoFocus
        />
      );
    }
    switch (column) {
      case 'start_time': return format(new Date(session.start_time), 'HH:mm');
      case 'end_time': return session.end_time ? format(new Date(session.end_time), 'HH:mm') : <Badge bg="info">Aktiv</Badge>;
      case 'break_duration_minutes': return `${session.break_duration_minutes} min`;
      default: return (session as any)[column];
    }
  };

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
                <td onDoubleClick={() => onCreate(day)}></td>
                <td onDoubleClick={() => onCreate(day)}></td>
                <td onDoubleClick={() => onCreate(day)}></td>
                <td>{formatDuration(targetMinutes)}</td>
                <td>{formatDuration(0)}</td>
                <td>{formatDuration(0 - targetMinutes)}</td>
                <td onDoubleClick={() => onCreate(day)}></td>
                <td></td>
              </tr>
            );
          }

          return sessionsForDay.map((session, index) => {
            const start = new Date(session.start_time);
            const end = session.end_time ? new Date(session.end_time) : null;
            const totalMinutes = end ? differenceInMinutes(end, start) : 0;
            const workMinutes = totalMinutes - (session.break_duration_minutes || 0);
            const deltaMinutes = workMinutes - (index === 0 ? targetMinutes : 0);

            return (
              <tr key={session.id} className={isWeekendDay ? 'table-info' : ''}>
                <td>{index === 0 ? format(day, 'dd.MM.yyyy (E)', { locale: de }) : ''}</td>
                <td onDoubleClick={() => handleDoubleClick(session, 'start_time')}>{renderCell(session, 'start_time', 0)}</td>
                <td onDoubleClick={() => handleDoubleClick(session, 'end_time')}>{renderCell(session, 'end_time', 1)}</td>
                <td onDoubleClick={() => handleDoubleClick(session, 'break_duration_minutes')}>{renderCell(session, 'break_duration_minutes', 2)}</td>
                <td>{index === 0 ? formatDuration(targetMinutes) : ''}</td>
                <td className="fw-bold">{formatDuration(workMinutes)}</td>
                <td className={deltaMinutes >= 0 ? 'text-success' : 'text-danger'}>{formatDuration(deltaMinutes)}</td>
                <td onDoubleClick={() => handleDoubleClick(session, 'notes')}>{renderCell(session, 'notes', 3)}</td>
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