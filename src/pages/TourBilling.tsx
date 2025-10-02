import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner, Table, Alert } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

type Tour = { id: number; name: string };
type BillingEntry = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  kilometers: number | null;
};
type BillingData = Record<string, Record<number, BillingEntry>>;

const fetchBillingData = async (year: number, month: number): Promise<{ tours: Tour[], billingData: BillingData }> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { 
      action: 'get-tour-billing-data',
      payload: { year, month }
    },
  });
  if (error) throw new Error(error.message);
  return data;
};

const TourBilling = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data, isLoading, error } = useQuery({
    queryKey: ['tourBilling', currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: () => fetchBillingData(currentMonth.getFullYear(), currentMonth.getMonth()),
  });

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
  }, [currentMonth]);

  const totals = useMemo(() => {
    if (!data) return {};
    const totals: Record<number, number> = {};
    for (const dateKey in data.billingData) {
      for (const tourId in data.billingData[dateKey]) {
        const entry = data.billingData[dateKey][tourId];
        if (entry && typeof entry.kilometers === 'number') {
          if (!totals[tourId]) {
            totals[tourId] = 0;
          }
          totals[tourId] += entry.kilometers;
        }
      }
    }
    return totals;
  }, [data]);

  const grandTotal = useMemo(() => {
    if (!totals) return 0;
    return Object.values(totals).reduce((sum, km) => sum + km, 0);
  }, [totals]);

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Tourenabrechnung</h1>
        <div className="d-flex align-items-center gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <h5 className="mb-0 fw-normal" style={{ width: '150px', textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </h5>
          <Button variant="outline-secondary" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <Card>
        <Card.Body className="table-responsive">
          {isLoading && <div className="text-center p-5"><Spinner /></div>}
          {error && <Alert variant="danger">Fehler beim Laden der Daten: {error.message}</Alert>}
          {data && (
            <Table bordered hover size="sm">
              <thead>
                <tr>
                  <th style={{minWidth: '120px'}}>Tag</th>
                  {data.tours.map(tour => <th key={tour.id} className="text-center">{tour.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {daysInMonth.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayData = data.billingData[dateKey] || {};
                  return (
                    <tr key={dateKey}>
                      <td>{format(day, 'E, dd.MM.', { locale: de })}</td>
                      {data.tours.map(tour => {
                        const entry = dayData[tour.id];
                        return (
                          <td key={tour.id} className="text-center">
                            {entry?.kilometers !== null && entry?.kilometers !== undefined ? entry.kilometers : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="fw-bold table-light">
                  <td>Gesamt</td>
                  {data.tours.map(tour => (
                    <td key={tour.id} className="text-center">
                      {totals[tour.id] || 0} km
                    </td>
                  ))}
                </tr>
              </tfoot>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card className="mt-4">
        <Card.Header>
          <Card.Title>Zusammenfassung</Card.Title>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <div className="text-center p-3"><Spinner /></div>
          ) : data && (
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Tour</th>
                  <th className="text-end">Gesamtkilometer</th>
                </tr>
              </thead>
              <tbody>
                {data.tours.map(tour => (
                  <tr key={tour.id}>
                    <td>{tour.name}</td>
                    <td className="text-end">{totals[tour.id] || 0} km</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="fw-bold table-light">
                  <td>Gesamt</td>
                  <td className="text-end">{grandTotal} km</td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default TourBilling;