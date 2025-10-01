import { Card, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { Clock, Calendar, Briefcase, TrendingUp } from 'lucide-react';
import { getDaysInMonth, isWeekend, eachDayOfInterval, startOfYear } from 'date-fns';

type WorkSession = {
  start_time: string;
  end_time: string | null;
  break_duration_minutes: number;
};

type WorkTimeSummaryProps = {
  sessions: WorkSession[];
  yearSessions: WorkSession[];
  targetHoursPerWeek: number | null;
  month: Date;
};

const formatHours = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '';
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = Math.round(absMinutes % 60);
  return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const WorkTimeSummary = ({ sessions, yearSessions, targetHoursPerWeek, month }: WorkTimeSummaryProps) => {
  // Monthly calculations
  const daysInMonth = getDaysInMonth(month);
  const netWorkingDaysMonth = Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))
    .filter(date => !isWeekend(date)).length;
  const actualWorkDaysMonth = new Set(sessions.map(s => new Date(s.start_time).toDateString())).size;
  const totalMinutesWorkedMonth = sessions.reduce((acc, s) => {
    if (!s.end_time) return acc;
    const diff = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60);
    return acc + (diff - s.break_duration_minutes);
  }, 0);
  const targetHoursPerDay = targetHoursPerWeek ? (targetHoursPerWeek / 5) : 0;
  const targetMinutesMonth = netWorkingDaysMonth * targetHoursPerDay * 60;
  const deltaMinutesMonth = totalMinutesWorkedMonth - targetMinutesMonth;
  const deltaColorMonth = deltaMinutesMonth >= 0 ? 'text-success' : 'text-danger';

  // Yearly calculations
  const today = new Date();
  const startOfYearDate = startOfYear(today);
  const daysInYearSoFar = eachDayOfInterval({ start: startOfYearDate, end: today });
  const netWorkingDaysYear = daysInYearSoFar.filter(date => !isWeekend(date)).length;
  const actualWorkDaysYear = new Set(yearSessions.map(s => new Date(s.start_time).toDateString())).size;
  const totalMinutesWorkedYear = yearSessions.reduce((acc, s) => {
    if (!s.end_time) return acc;
    const diff = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / (1000 * 60);
    return acc + (diff - s.break_duration_minutes);
  }, 0);
  const targetMinutesYear = netWorkingDaysYear * targetHoursPerDay * 60;
  const deltaMinutesYear = totalMinutesWorkedYear - targetMinutesYear;
  const deltaColorYear = deltaMinutesYear >= 0 ? 'text-success' : 'text-danger';

  return (
    <Card className="mb-4">
      <Tabs defaultActiveKey="month" id="summary-tabs" className="card-header-tabs">
        <Tab eventKey="month" title="Monatsübersicht">
          <Card.Body>
            <Row>
              <Col><Stat title="Soll-Stunden" value={formatHours(targetMinutesMonth)} icon={<Clock />} /></Col>
              <Col><Stat title="Ist-Stunden" value={formatHours(totalMinutesWorkedMonth)} icon={<Clock />} /></Col>
              <Col><Stat title="Über-/Unterstunden" value={formatHours(deltaMinutesMonth)} icon={<TrendingUp />} valueColor={deltaColorMonth} /></Col>
              <Col><Stat title="Soll-Arbeitstage" value={String(netWorkingDaysMonth)} icon={<Calendar />} note="Ohne Feiertage" /></Col>
              <Col><Stat title="Ist-Arbeitstage" value={String(actualWorkDaysMonth)} icon={<Briefcase />} /></Col>
            </Row>
          </Card.Body>
        </Tab>
        <Tab eventKey="year" title="Jahresübersicht">
          <Card.Body>
            <Row>
              <Col><Stat title="Soll-Stunden" value={formatHours(targetMinutesYear)} icon={<Clock />} /></Col>
              <Col><Stat title="Ist-Stunden" value={formatHours(totalMinutesWorkedYear)} icon={<Clock />} /></Col>
              <Col><Stat title="Über-/Unterstunden" value={formatHours(deltaMinutesYear)} icon={<TrendingUp />} valueColor={deltaColorYear} /></Col>
              <Col><Stat title="Soll-Arbeitstage" value={String(netWorkingDaysYear)} icon={<Calendar />} note={`Bis heute`} /></Col>
              <Col><Stat title="Ist-Arbeitstage" value={String(actualWorkDaysYear)} icon={<Briefcase />} /></Col>
            </Row>
          </Card.Body>
        </Tab>
      </Tabs>
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