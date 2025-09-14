import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { YearView } from '@/components/vacation/YearView';
import type { UserVacations } from '@/types/vacation';

const fetchVacations = async (year: number): Promise<UserVacations[]> => {
  const { data, error } = await supabase.functions.invoke('get-vacations-for-year', {
    body: { year },
  });
  if (error) throw new Error(error.message);
  return data.vacations;
};

const VacationCalendar = () => {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, error } = useQuery({
    queryKey: ['vacations', year],
    queryFn: () => fetchVacations(year),
  });

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2">Urlaubskalender</h1>
        <div className="d-flex align-items-center gap-2">
          <Button variant="outline-secondary" onClick={() => setYear(y => y - 1)}><ChevronLeft /></Button>
          <span className="h4 mb-0 fw-normal">{year}</span>
          <Button variant="outline-secondary" onClick={() => setYear(y => y + 1)}><ChevronRight /></Button>
        </div>
      </div>
      <Card>
        <Card.Body>
          {isLoading && <div className="text-center p-5"><Spinner /></div>}
          {error && <p className="text-danger">Fehler: {error.message}</p>}
          {data && data.length > 0 ? (
            <YearView year={year} data={data} />
          ) : (
            !isLoading && <p className="text-muted text-center p-5">Keine genehmigten Urlaube für {year} gefunden.</p>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default VacationCalendar;