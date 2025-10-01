import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Button, Form, Row, Col, Table } from 'react-bootstrap';
import { showError } from '@/utils/toast';
import { format, startOfYear, eachMonthOfInterval, endOfYear, getDaysInMonth, isWeekend, parseISO, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Clock, Calendar, Briefcase, TrendingUp } from 'lucide-react';
import { useSearchParams, NavLink } from 'react-router-dom';
import Select from 'react-select';
import type { ChatUser } from '@/types/chat';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const fetchAnnualSummary = async (userId: string, year: number) => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-annual-work-time-summary', payload: { userId, year } },
  });
  if (error) throw error;
  return data;
};

const formatHours = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '';
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = Math.round(absMinutes % 60);
  return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const Stat = ({ title, value, icon, note, valueColor }: { title: string, value: string, icon: React.ReactNode, note?: string, valueColor?: string }) => (
  <div className="text-center">
    <div className="text-muted">{icon} {title}</div>
    <div className={`h4 fw-bold ${valueColor || ''}`}>{value}</div>
    {note && <div className="small text-muted">{note}</div>}
  </div>
);

const WorkTimeAnnualSummary = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get('userId'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const { data: users, isLoading: isLoadingUsers } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
  });

  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['annualSummary', selectedUserId, selectedYear],
    queryFn: () => fetchAnnualSummary(selectedUserId!, selectedYear),
    enabled: !!selectedUserId,
  });

  const processedData = useMemo(() => {
    if (!summaryData) return null;
    const { sessions, workHoursHistory } = summaryData;
    
    const getTargetHoursForDate = (date: Date) => {
      if (!workHoursHistory || workHoursHistory.length === 0) return 0;
      const relevantHistory = workHoursHistory.filter((h: any) => new Date(h.effective_date) <= date);
      return relevantHistory.length > 0 ? relevantHistory[relevantHistory.length - 1].hours_per_week : 0;
    };

    const months = eachMonthOfInterval({ start: startOfYear(new Date(selectedYear, 0, 1)), end: endOfYear(new Date(selectedYear, 0, 1)) });
    
    const monthlyData = months.map(month => {
      const monthKey = format(month, 'yyyy-MM');
      const sessionsInMonth = sessions.filter((s: any) => format(parseISO(s.start_time), 'yyyy-MM') === monthKey);
      
      const daysInMonth = eachDayOfInterval({ start: month, end: new Date(month.getFullYear(), month.getMonth() + 1, 0) });
      let targetMinutes = 0;
      for (const day of daysInMonth) {
        if (!isWeekend(day)) {
          const targetHours = getTargetHoursForDate(day);
          targetMinutes += (targetHours / 5) * 60;
        }
      }

      const actualMinutes = sessionsInMonth.reduce((acc: number, s: any) => {
        if (!s.end_time) return acc;
        const diff = (parseISO(s.end_time).getTime() - parseISO(s.start_time).getTime()) / (1000 * 60);
        return acc + (diff - s.break_duration_minutes);
      }, 0);

      return {
        month: format(month, 'MMM', { locale: de }),
        target: targetMinutes,
        actual: actualMinutes,
        delta: actualMinutes - targetMinutes,
      };
    });

    const totalTarget = monthlyData.reduce((sum, m) => sum + m.target, 0);
    const totalActual = monthlyData.reduce((sum, m) => sum + m.actual, 0);
    const totalDelta = totalActual - totalTarget;

    return { monthlyData, totalTarget, totalActual, totalDelta };
  }, [summaryData, selectedYear]);

  const userOptions = users?.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() }));
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => ({ value: y, label: String(y) }));

  const handleUserChange = (option: any) => {
    const userId = option?.value || null;
    setSelectedUserId(userId);
    if (userId) {
      setSearchParams({ userId });
    } else {
      setSearchParams({});
    }
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <NavLink to="/work-time-admin" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
          <h1 className="h2 mb-0">Jahresübersicht Zeiterfassung</h1>
        </div>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Mitarbeiter</Form.Label>
                <Select options={userOptions} isLoading={isLoadingUsers} value={userOptions?.find(o => o.value === selectedUserId)} onChange={handleUserChange} placeholder="Mitarbeiter auswählen..." isClearable />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Jahr</Form.Label>
                <Select options={yearOptions} value={yearOptions.find(o => o.value === selectedYear)} onChange={(opt) => setSelectedYear(opt!.value)} />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoadingSummary && <div className="text-center"><Spinner /></div>}
      
      {processedData && (
        <div className="d-flex flex-column gap-4">
          <Card>
            <Card.Header><Card.Title>Jahresbilanz {selectedYear}</Card.Title></Card.Header>
            <Card.Body>
              <Row>
                <Col><Stat title="Soll-Stunden (Jahr)" value={formatHours(processedData.totalTarget)} icon={<Clock />} /></Col>
                <Col><Stat title="Ist-Stunden (Jahr)" value={formatHours(processedData.totalActual)} icon={<Clock />} /></Col>
                <Col><Stat title="Gesamtsaldo" value={formatHours(processedData.totalDelta)} icon={<TrendingUp />} valueColor={processedData.totalDelta >= 0 ? 'text-success' : 'text-danger'} /></Col>
              </Row>
            </Card.Body>
          </Card>

          <Row>
            <Col lg={7}>
              <Card>
                <Card.Header><Card.Title>Monatsübersicht</Card.Title></Card.Header>
                <Card.Body>
                  <Table striped bordered hover size="sm">
                    <thead><tr><th>Monat</th><th>Soll</th><th>Ist</th><th>Saldo</th></tr></thead>
                    <tbody>
                      {processedData.monthlyData.map(m => (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td>{formatHours(m.target)}</td>
                          <td>{formatHours(m.actual)}</td>
                          <td className={m.delta >= 0 ? 'text-success' : 'text-danger'}>{formatHours(m.delta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={5}>
              <Card>
                <Card.Header><Card.Title>Monatssaldo</Card.Title></Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={processedData.monthlyData.map(m => ({...m, delta: m.delta / 60}))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis label={{ value: 'Stunden', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(2)} Std.`} />
                      <Legend />
                      <Bar dataKey="delta" name="Stundensaldo" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </>
  );
};

export default WorkTimeAnnualSummary;