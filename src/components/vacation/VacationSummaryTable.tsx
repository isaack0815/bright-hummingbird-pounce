import { useMemo } from 'react';
import { Table } from 'react-bootstrap';
import { eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import type { VacationRequest, UserWithVacationDetails } from '@/types/vacation';
import TablePlaceholder from '@/components/TablePlaceholder';

type VacationSummaryTableProps = {
  users: UserWithVacationDetails[];
  requests: VacationRequest[];
  year: number;
  isLoading: boolean;
};

const calculateTakenDays = (userRequests: VacationRequest[], worksWeekends: boolean | null, year: number) => {
  let totalDays = 0;
  const approvedRequests = userRequests.filter(r => r.status === 'approved');

  for (const req of approvedRequests) {
    const start = parseISO(req.start_date);
    const end = parseISO(req.end_date);

    if (start.getFullYear() > year || end.getFullYear() < year) {
      continue;
    }

    const effectiveStart = start.getFullYear() < year ? new Date(year, 0, 1) : start;
    const effectiveEnd = end.getFullYear() > year ? new Date(year, 11, 31) : end;

    const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
    const vacationDays = worksWeekends ? days : days.filter(day => !isWeekend(day));
    totalDays += vacationDays.length;
  }
  return totalDays;
};

export const VacationSummaryTable = ({ users, requests, year, isLoading }: VacationSummaryTableProps) => {
  const summaryData = useMemo(() => {
    return users.map(user => {
      const userRequests = requests.filter(r => r.user_id === user.id);
      const totalDays = user.vacation_days_per_year ?? 0;
      const takenDays = calculateTakenDays(userRequests, user.works_weekends, year);
      const remainingDays = totalDays - takenDays;

      return {
        userId: user.id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        total: totalDays,
        taken: takenDays,
        remaining: remainingDays,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, requests, year]);

  if (isLoading) {
    return <TablePlaceholder rows={5} cols={4} />;
  }

  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>Mitarbeiter</th>
          <th>Gesamtanspruch</th>
          <th>Genommen</th>
          <th>Resturlaub</th>
        </tr>
      </thead>
      <tbody>
        {summaryData.map(row => (
          <tr key={row.userId}>
            <td>{row.name}</td>
            <td>{row.total > 0 ? `${row.total} Tage` : '-'}</td>
            <td>{row.taken} Tage</td>
            <td className={row.remaining < 0 ? 'text-danger fw-bold' : ''}>
              {row.total > 0 ? `${row.remaining} Tage` : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};