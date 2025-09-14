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

  // Step 1: Fetch vacation requests without the join
  const { data: requests, error: requestsError } = await supabase
    .from('vacation_requests')
    .select('user_id, start_date, end_date')
    .eq('status', 'approved')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (requestsError) throw new Error(requestsError.message);
  if (!requests || requests.length === 0) return [];

  // Step 2: Get unique user IDs
  const userIds = [...new Set(requests.map(req => req.user_id))];
  if (userIds.length === 0) return [];

  // Step 3: Fetch profiles for those users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds);
  
  if (profilesError) throw new Error(profilesError.message);
  if (!profiles) return [];

  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  // Step 4: Combine the data
  const vacationsByUser = requests.reduce((acc: Record<string, UserVacations>, req) => {
    const profile = profilesMap.get(req.user_id);
    if (!profile) return acc; // Skip if profile not found

    const userId = req.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        userId,
        firstName: profile.first_name,
        lastName: profile.last_name,
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