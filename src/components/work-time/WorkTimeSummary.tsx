import { Card, Row, Col } from 'react-bootstrap';
import { Clock, Calendar, Briefcase, TrendingUp } from 'lucide-react';
import { getDaysInMonth, isWeekday } from 'date-fns';

type WorkSession = {
  start_time: string;
  end_time: string | null;
  break_duration_minutes: number;
};

type WorkTimeSummaryProps = {
  sessions: WorkSession[];
  targetHoursPerWeek: number | null;
  month: Date;
};

const formatHours = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const WorkTimeSummary = ({ sessions, targetHoursPerWeek, month }: WorkTimeSummaryProps) => {
  const daysInMonth = getDaysInMonth(month);
  const netWorkingDays = Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))
    .filter(isWeekday).length;

  const actualWorkDays = new Set(sessions.map(s => new Date(s.start_time).toDateString())).size;

  const totalMinutesWorked = sessions.reduce((acc, s) => {
    if (!s.end_time) return acc;
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60);
    return acc + (diff - s.break_duration_minutes);
  }, 0);

  const targetHoursPerDay = targetHoursPerWeek ? (targetHoursPerWeek / 5) : 0;
  const targetMinutesMonth = netWorkingDays * targetHoursPerDay * 60;
  const deltaMinutes = totalMinutesWorked - targetMinutesMonth;

  const deltaColor = deltaMinutes >= 0 ? 'text-success' : 'text-danger';

  return (
    <Card className="mb-4">
      <Card.Body>
        <Row>
          <Col><Stat title="Soll-Stunden (Monat)" value={formatHours(targetMinutesMonth)} icon={<Clock />} /></Col>
          <Col><Stat title="Ist-Stunden (Monat)" value={formatHours(totalMinutesWorked)} icon={<Clock />} /></Col>
          <Col><Stat title="Über-/Unterstunden" value={formatHours(deltaMinutes)} icon={<TrendingUp />} valueColor={deltaColor} /></Col>
          <Col><Stat title="Soll-Arbeitstage" value={String(netWorkingDays)} icon={<Calendar />} note="Ohne Feiertage" /></Col>
          <Col><Stat title="Ist-Arbeitstage" value={String(actualWorkDays)} icon={<Briefcase />} /></Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

const Stat = ({ title, value, icon, note, valueColor }: { title: string, value: string, icon: React.ReactNode, note?: string, valueColor?: string }) => (
  <div className="text-center">
    <div className="text-muted">{icon} {title}</div>
    <div className={`h4 fw-bold ${valueColor || ''}`}>{value}</div>
    {note && <div className="small text-muted">{note}</div>}
  </div>
);