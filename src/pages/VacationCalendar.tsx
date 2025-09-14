import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner, Form, Tabs, Tab } from 'react-bootstrap';
import { PlusCircle } from 'lucide-react';
import { MonthlyVacationTable } from '@/components/vacation/MonthlyVacationTable';
import { AddVacationRequestDialog } from '@/components/vacation/AddVacationRequestDialog';
import type { UserVacations } from '@/types/vacation';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const fetchVacations = async (year: number): Promise<UserVacations[]> => {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Step 1: Fetch approved vacation requests
  const { data: requests, error: requestsError } = await supabase
    .from('vacation_requests')
    .select('user_id, start_date, end_date')
    .eq('status', 'approved')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (requestsError) throw new Error(requestsError.message);
  if (!requests || requests.length === 0) return [];

  // Step 2: Get unique user IDs from requests
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

  // Step 4: Combine requests with profile data
  const vacationsByUser = requests.reduce((acc: Record<string, UserVacations>, req) => {
    const profile = profilesMap.get(req.user_id);
    if (!profile) return acc;

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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const currentMonthIndex = new Date().getMonth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['vacations', year],
    queryFn: () => fetchVacations(year),
  });

  const yearOptions = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">Urlaubskalender</h1>
          <div className="d-flex align-items-center gap-3">
            <Form.Select value={year} onChange={e => setYear(Number(e.target.value))} style={{width: '120px'}}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </Form.Select>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle size={16} className="me-2" />
              Urlaub beantragen
            </Button>
          </div>
        </div>
        
        {isLoading && <div className="text-center p-5"><Spinner /></div>}
        {error && <p className="text-danger">Fehler: {error.message}</p>}
        
        {data && data.length > 0 && (
          <Tabs defaultActiveKey={currentMonthIndex} id="month-tabs" className="mb-3">
            {months.map((month, index) => (
              <Tab eventKey={index} title={format(month, 'MMMM', { locale: de })} key={index}>
                <Card>
                  <Card.Body className="p-0">
                    <MonthlyVacationTable year={year} month={index} data={data} />
                  </Card.Body>
                </Card>
              </Tab>
            ))}
          </Tabs>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <Card>
            <Card.Body className="text-center text-muted p-5">
              Keine genehmigten Urlaube für {year} gefunden.
            </Card.Body>
          </Card>
        )}
      </Container>
      <AddVacationRequestDialog 
        show={isAddDialogOpen} 
        onHide={() => setIsAddDialogOpen(false)} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['vacationRequests'] });
          queryClient.invalidateQueries({ queryKey: ['vacations', year] });
        }}
      />
    </>
  );
};

export default VacationCalendar;