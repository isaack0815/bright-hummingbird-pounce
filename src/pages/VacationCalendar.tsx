import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { YearView } from '@/components/vacation/YearView';
import type { UserVacations } from '@/types/vacation';

const fetchVacations = async (year: number): Promise<UserVacations[]> => {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: requests, error } = await supabase
    .from('vacation_requests')
    .select('user_id, start_date, end_date, profiles(id, first_name, last_name)')
    .eq('status', 'approved')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (error) throw new Error(error.message);
  if (!requests) return [];

  // Group by user
  const vacationsByUser = requests.reduce((acc: any, req: any) => {
    if (!req.profiles) return acc;
    const userId = req.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        userId,
        firstName: req.profiles.first_name,
        lastName: req.profiles.last_name,
        vacations: [],
      };
    }
    acc[userId].vacations.push({
      start: req.start_date,
      end: req.end_date,
    });
    return acc;
  }, {});

  return Object.values(vacationsByUser);
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