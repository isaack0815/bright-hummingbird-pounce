import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, Alert, Form, Button, ButtonGroup, Table, Spinner } from 'react-bootstrap';
import { ArrowLeft, BarChart2, Euro, Truck, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { NavLink } from 'react-router-dom';
import type { Vehicle, VehicleGroup } from '@/types/vehicle';

type AnalyticsData = {
  orders: {
    id: number;
    order_number: string;
    price: number;
    calculated_cost: number;
    delivery_date: string;
  }[];
  summary: {
    total_revenue: number;
    total_calculated_cost: number;
    total_orders: number;
    profit: number;
  };
};

const fetchVehicleGroups = async (): Promise<VehicleGroup[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicle-groups');
  if (error) throw new Error(error.message);
  return data.groups;
};

const fetchVehicles = async (): Promise<Vehicle[]> => {
  const { data, error } = await supabase.functions.invoke('get-vehicles');
  if (error) throw new Error(error.message);
  return data.vehicles;
};

const fetchAnalytics = async (vehicleId: number, startDate: string, endDate: string): Promise<AnalyticsData> => {
  const { data, error } = await supabase.functions.invoke('get-vehicle-analytics', {
    body: { vehicleId, startDate, endDate },
  });
  if (error) throw error;
  return data;
};

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: string, icon: React.ReactNode, isLoading: boolean }) => (
  <Card className="shadow-sm h-100">
    <Card.Body>
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <h6 className="card-subtitle mb-2 text-muted">{title}</h6>
          {isLoading ? <Spinner size="sm" /> : <div className="h3 fw-bold">{value}</div>}
        </div>
        {icon}
      </div>
    </Card.Body>
  </Card>
);

const VehicleAnalytics = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'year'>('month');

  const { data: groups, isLoading: isLoadingGroups } = useQuery({ queryKey: ['vehicleGroups'], queryFn: fetchVehicleGroups });
  const { data: allVehicles, isLoading: isLoadingVehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles });

  const vehiclesInGroup = useMemo(() => {
    if (!allVehicles) return [];
    if (!selectedGroupId) return allVehicles;
    return allVehicles.filter(v => v.group_id === selectedGroupId);
  }, [allVehicles, selectedGroupId]);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (timePeriod) {
      case 'week': return { startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      case 'month': return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'year': return { startDate: format(startOfYear(now), 'yyyy-MM-dd'), endDate: format(endOfYear(now), 'yyyy-MM-dd') };
    }
  }, [timePeriod]);

  const { data: analyticsData, isLoading: isLoadingAnalytics, error } = useQuery({
    queryKey: ['vehicleAnalytics', selectedVehicleId, timePeriod],
    queryFn: () => fetchAnalytics(selectedVehicleId!, startDate, endDate),
    enabled: !!selectedVehicleId,
  });

  const chartData = useMemo(() => {
    if (!analyticsData) return [];
    const groupedData = analyticsData.orders.reduce((acc, order) => {
      const date = parseISO(order.delivery_date);
      const key = timePeriod === 'year' ? format(date, 'MMM', { locale: de }) : format(date, 'dd.MM');
      if (!acc[key]) {
        acc[key] = { name: key, Umsatz: 0, Kosten: 0 };
      }
      acc[key].Umsatz += order.price || 0;
      acc[key].Kosten += order.calculated_cost || 0;
      return acc;
    }, {} as Record<string, { name: string; Umsatz: number; Kosten: number }>);
    return Object.values(groupedData);
  }, [analyticsData, timePeriod]);

  return (
    <Container fluid>
      <div className="d-flex align-items-center gap-3 mb-4">
        <NavLink to="/vehicles" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
        <h1 className="h2 mb-0">Fahrzeugauswertung</h1>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Fahrzeuggruppe</Form.Label>
                <Form.Select onChange={e => { setSelectedGroupId(Number(e.target.value) || null); setSelectedVehicleId(null); }} disabled={isLoadingGroups}>
                  <option value="">Alle Gruppen</option>
                  {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Fahrzeug</Form.Label>
                <Form.Select onChange={e => setSelectedVehicleId(Number(e.target.value) || null)} disabled={isLoadingVehicles || !vehiclesInGroup.length}>
                  <option value="">Fahrzeug auswählen...</option>
                  {vehiclesInGroup.map(v => <option key={v.id} value={v.id}>{v.license_plate}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Label>Zeitraum</Form.Label>
              <ButtonGroup className="w-100">
                <Button variant={timePeriod === 'week' ? 'primary' : 'outline-secondary'} onClick={() => setTimePeriod('week')}>Woche</Button>
                <Button variant={timePeriod === 'month' ? 'primary' : 'outline-secondary'} onClick={() => setTimePeriod('month')}>Monat</Button>
                <Button variant={timePeriod === 'year' ? 'primary' : 'outline-secondary'} onClick={() => setTimePeriod('year')}>Jahr</Button>
              </ButtonGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {!selectedVehicleId ? (
        <Alert variant="info">Bitte wählen Sie ein Fahrzeug aus, um die Auswertung anzuzeigen.</Alert>
      ) : error ? (
        <Alert variant="danger">Fehler beim Laden der Daten: {(error as Error).message}</Alert>
      ) : (
        <>
          <Row className="g-4 mb-4">
            <Col md={3}><StatCard title="Umsatz" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(analyticsData?.summary.total_revenue || 0)} icon={<Euro />} isLoading={isLoadingAnalytics} /></Col>
            <Col md={3}><StatCard title="Kalk. Kosten" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(analyticsData?.summary.total_calculated_cost || 0)} icon={<Euro />} isLoading={isLoadingAnalytics} /></Col>
            <Col md={3}><StatCard title="Profit" value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(analyticsData?.summary.profit || 0)} icon={<TrendingUp />} isLoading={isLoadingAnalytics} /></Col>
            <Col md={3}><StatCard title="Aufträge" value={String(analyticsData?.summary.total_orders || 0)} icon={<Truck />} isLoading={isLoadingAnalytics} /></Col>
          </Row>

          <Card className="mb-4">
            <Card.Header><Card.Title className="d-flex align-items-center"><BarChart2 className="me-2" />Umsatz vs. Kosten</Card.Title></Card.Header>
            <Card.Body>
              {isLoadingAnalytics ? <div className="text-center"><Spinner /></div> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value as number)} />
                    <Tooltip formatter={(value) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value as number)} />
                    <Legend />
                    <Bar dataKey="Umsatz" fill="#82ca9d" />
                    <Bar dataKey="Kosten" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><Card.Title>Gefahrene Aufträge</Card.Title></Card.Header>
            <Card.Body>
              {isLoadingAnalytics ? <div className="text-center"><Spinner /></div> : (
                <Table responsive striped bordered hover size="sm">
                  <thead><tr><th>Auftragsnr.</th><th>Lieferdatum</th><th>Umsatz</th><th>Kalk. Kosten</th><th>Differenz</th></tr></thead>
                  <tbody>
                    {analyticsData?.orders.map(order => {
                      const profit = (order.price || 0) - (order.calculated_cost || 0);
                      return (
                        <tr key={order.id}>
                          <td><NavLink to={`/freight-orders/edit/${order.id}`}>{order.order_number}</NavLink></td>
                          <td>{format(parseISO(order.delivery_date), 'dd.MM.yyyy')}</td>
                          <td>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(order.price || 0)}</td>
                          <td>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(order.calculated_cost || 0)}</td>
                          <td className={profit >= 0 ? 'text-success' : 'text-danger'}>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(profit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
};

export default VehicleAnalytics;