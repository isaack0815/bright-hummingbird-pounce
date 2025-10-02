import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner, Table, Alert, Row, Col, Form } from 'react-bootstrap';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { showSuccess, showError } from '@/utils/toast';

type Tour = { id: number; name: string; tour_type: string | null };
type BillingEntry = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  kilometers: number | null;
  is_override: boolean;
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
  const [editedData, setEditedData] = useState<BillingData | null>(null);
  const [editingCell, setEditingCell] = useState<{ date: string; tourId: number } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tourBilling', currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: () => fetchBillingData(currentMonth.getFullYear(), currentMonth.getMonth()),
  });

  useEffect(() => {
    if (data) {
      setEditedData(JSON.parse(JSON.stringify(data.billingData)));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (overrides: any[]) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'save-tour-billing-overrides', payload: { overrides } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Änderungen gespeichert!");
      queryClient.invalidateQueries({ queryKey: ['tourBilling', currentMonth.getFullYear(), currentMonth.getMonth()] });
    },
    onError: (err: any) => showError(err.message || "Fehler beim Speichern."),
  });

  const handleSave = () => {
    if (!data || !editedData) return;
    const changes = [];
    for (const date in editedData) {
      for (const tourId in editedData[date]) {
        const originalKm = data.billingData[date]?.[tourId]?.kilometers;
        const editedKm = editedData[date][tourId].kilometers;
        if (originalKm !== editedKm) {
          changes.push({ date, tourId: Number(tourId), kilometers: editedKm });
        }
      }
    }
    if (changes.length > 0) {
      saveMutation.mutate(changes);
    } else {
      showSuccess("Keine Änderungen zum Speichern vorhanden.");
    }
  };

  const handleCellChange = (date: string, tourId: number, value: string) => {
    setEditedData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[date]) newData[date] = {};
      if (!newData[date][tourId]) newData[date][tourId] = { kilometers: null, is_override: true };
      newData[date][tourId].kilometers = value === '' ? null : Number(value);
      newData[date][tourId].is_override = true;
      return newData;
    });
  };

  const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);
  
  const handleKeyDown = (e: React.KeyboardEvent, currentDate: string, currentTourId: number) => {
    if (e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Escape') return;
    
    if (e.key === 'Escape') {
        (e.target as HTMLElement).blur();
        return;
    }

    e.preventDefault();
    (e.target as HTMLElement).blur();

    const tours = data?.tours || [];
    const days = daysInMonth.map(d => format(d, 'yyyy-MM-dd'));

    const currentRowIndex = days.indexOf(currentDate);
    const currentColIndex = tours.findIndex(t => t.id === currentTourId);

    let nextRowIndex = currentRowIndex;
    let nextColIndex = currentColIndex;

    if (e.key === 'Enter') {
        nextRowIndex++;
    } else if (e.key === 'Tab') {
        if (e.shiftKey) { // Move Right
            nextColIndex++;
            if (nextColIndex >= tours.length) {
                nextColIndex = 0;
                nextRowIndex++;
            }
        } else { // Move Left
            nextColIndex--;
            if (nextColIndex < 0) {
                nextColIndex = tours.length - 1;
                nextRowIndex--;
            }
        }
    }

    if (nextRowIndex >= 0 && nextRowIndex < days.length && nextColIndex >= 0 && nextColIndex < tours.length) {
        const nextDate = days[nextRowIndex];
        const nextTourId = tours[nextColIndex].id;
        
        setTimeout(() => {
            setEditingCell({ date: nextDate, tourId: nextTourId });
        }, 10);
    }
  };

  const totals = useMemo(() => {
    if (!editedData) return {};
    const totals: Record<number, number> = {};
    for (const dateKey in editedData) {
      for (const tourId in editedData[dateKey]) {
        const entry = editedData[dateKey][tourId];
        if (entry && typeof entry.kilometers === 'number') {
          if (!totals[tourId]) totals[tourId] = 0;
          totals[tourId] += entry.kilometers;
        }
      }
    }
    return totals;
  }, [editedData]);
  const grandTotal = useMemo(() => Object.values(totals).reduce((sum, km) => sum + km, 0), [totals]);
  const { regularTours, onCallTours } = useMemo(() => {
    if (!data?.tours) return { regularTours: [], onCallTours: [] };
    return {
      regularTours: data.tours.filter(t => t.tour_type !== 'bereitschaft'),
      onCallTours: data.tours.filter(t => t.tour_type === 'bereitschaft'),
    };
  }, [data]);
  const grandTotalRegular = useMemo(() => regularTours.reduce((sum, tour) => sum + (totals[tour.id] || 0), 0), [totals, regularTours]);
  const grandTotalOnCall = useMemo(() => onCallTours.reduce((sum, tour) => sum + (totals[tour.id] || 0), 0), [totals, onCallTours]);
  const hasOverrides = useMemo(() => Object.values(editedData || {}).some(day => Object.values(day).some(entry => entry.is_override)), [editedData]);

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Tourenabrechnung</h1>
        <div className="d-flex align-items-center gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={16} /></Button>
          <h5 className="mb-0 fw-normal" style={{ width: '150px', textAlign: 'center' }}>{format(currentMonth, 'MMMM yyyy', { locale: de })}</h5>
          <Button variant="outline-secondary" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={16} /></Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}><Save size={16} className="me-2" />{saveMutation.isPending ? 'Speichern...' : 'Änderungen speichern'}</Button>
        </div>
      </div>

      {hasOverrides && <Alert variant="info">Sie sehen zwischengespeicherte, manuell angepasste Werte. Klicken Sie auf "Änderungen speichern", um diese final zu übernehmen.</Alert>}

      <Card>
        <Card.Body className="table-responsive">
          {isLoading && <div className="text-center p-5"><Spinner /></div>}
          {error && <Alert variant="danger">Fehler beim Laden der Daten: {error.message}</Alert>}
          {data && editedData && (
            <Table bordered hover size="sm">
              <thead><tr><th style={{minWidth: '120px'}}>Tag</th>{data.tours.map(tour => <th key={tour.id} className="text-center">{tour.name}</th>)}</tr></thead>
              <tbody>
                {daysInMonth.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayData = editedData[dateKey] || {};
                  return (
                    <tr key={dateKey}>
                      <td>{format(day, 'E, dd.MM.', { locale: de })}</td>
                      {data.tours.map(tour => {
                        const entry = dayData[tour.id];
                        const isEditing = editingCell?.date === dateKey && editingCell?.tourId === tour.id;
                        return (
                          <td key={tour.id} className={`text-center ${entry?.is_override ? 'table-warning' : ''}`} onClick={() => setEditingCell({ date: dateKey, tourId: tour.id })}>
                            {isEditing ? (
                              <Form.Control
                                type="number"
                                size="sm"
                                autoFocus
                                defaultValue={entry?.kilometers ?? ''}
                                onBlur={(e) => { handleCellChange(dateKey, tour.id, e.target.value); setEditingCell(null); }}
                                onKeyDown={(e) => handleKeyDown(e, dateKey, tour.id)}
                              />
                            ) : (
                              entry?.kilometers ?? '-'
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="fw-bold table-light"><td>Gesamt</td>{data.tours.map(tour => (<td key={tour.id} className="text-center">{totals[tour.id] || 0} km</td>))}</tr></tfoot>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Card className="mt-4">
        <Card.Header><Card.Title>Zusammenfassung</Card.Title></Card.Header>
        <Card.Body>
          {isLoading ? <div className="text-center p-3"><Spinner /></div> : data && (
            <>
              <Row>
                <Col md={6}>
                  <h6>Reguläre Touren</h6>
                  <Table striped bordered hover size="sm">
                    <thead><tr><th>Tour</th><th className="text-end">Gesamtkilometer</th></tr></thead>
                    <tbody>{regularTours.map(tour => (<tr key={tour.id}><td>{tour.name}</td><td className="text-end">{totals[tour.id] || 0} km</td></tr>))}</tbody>
                    <tfoot><tr className="fw-bold table-light"><td>Gesamt Regulär</td><td className="text-end">{grandTotalRegular} km</td></tr></tfoot>
                  </Table>
                </Col>
                <Col md={6}>
                  <h6>Bereitschaftstouren</h6>
                  <Table striped bordered hover size="sm">
                    <thead><tr><th>Tour</th><th className="text-end">Gesamtkilometer</th></tr></thead>
                    <tbody>{onCallTours.map(tour => (<tr key={tour.id}><td>{tour.name}</td><td className="text-end">{totals[tour.id] || 0} km</td></tr>))}</tbody>
                    <tfoot><tr className="fw-bold table-light"><td>Gesamt Bereitschaft</td><td className="text-end">{grandTotalOnCall} km</td></tr></tfoot>
                  </Table>
                </Col>
              </Row>
              <hr />
              <h5 className="text-end">Gesamtkilometer (Alle Touren): {grandTotal} km</h5>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default TourBilling;