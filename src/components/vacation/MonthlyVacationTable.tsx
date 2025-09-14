import { useMemo } from 'react';
import { Table, Badge } from 'react-bootstrap';
import { format, getDaysInMonth, isWithinInterval, parseISO, isWeekend, startOfDay } from 'date-fns';
import type { VacationRequest } from '@/types/vacation';

type ProcessedUserVacation = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  vacations: {
    start: string;
    end: string;
    status: 'pending' | 'approved' | 'rejected';
  }[];
};

type MonthlyVacationTableProps = {
  year: number;
  month: number; // 0-11
  requests: VacationRequest[];
};

export const MonthlyVacationTable = ({ year, month, requests }: MonthlyVacationTableProps) => {
  const daysInMonth = useMemo(() => {
    const date = new Date(year, month, 1);
    const days = getDaysInMonth(date);
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }, [year, month]);

  const processedData = useMemo(() => {
    const usersMap = new Map<string, ProcessedUserVacation>();
    requests.forEach(req => {
      if (!req.profiles) return;
      const userId = req.user_id;
      if (!usersMap.has(userId)) {
        usersMap.set(userId, {
          userId,
          firstName: req.profiles.first_name,
          lastName: req.profiles.last_name,
          vacations: [],
        });
      }
      usersMap.get(userId)!.vacations.push({
        start: req.start_date,
        end: req.end_date,
        status: req.status,
      });
    });
    return Array.from(usersMap.values()).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [requests]);

  return (
    <div className="table-responsive">
      <Table bordered className="bg-white vacation-table mb-0">
        <thead>
          <tr>
            <th className="sticky-col">Angestellter</th>
            {daysInMonth.map(day => {
              const isWeekendDay = isWeekend(day);
              return (
                <th key={day.getDate()} className={`text-center p-1 ${isWeekendDay ? 'table-info' : ''}`} style={{minWidth: '35px'}}>
                  {format(day, 'd')}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {processedData.map(user => (
            <tr key={user.userId}>
              <td className="fw-medium sticky-col">
                {`${user.firstName || ''} ${user.lastName || ''}`.trim()}
              </td>
              {daysInMonth.map(day => {
                const currentDate = startOfDay(day);
                const vacation = user.vacations.find(v => 
                  isWithinInterval(currentDate, { start: parseISO(v.start), end: parseISO(v.end) })
                );
                const isWeekendDay = isWeekend(day);
                
                let cellClass = '';
                let badge = null;

                if (vacation) {
                  switch (vacation.status) {
                    case 'approved':
                      cellClass = 'table-warning';
                      badge = <Badge bg="success" pill className="p-1">U</Badge>;
                      break;
                    case 'pending':
                      cellClass = 'table-secondary';
                      badge = <Badge bg="warning" pill className="p-1">A</Badge>;
                      break;
                    // Abgelehnte Anträge werden in der Übersicht nicht angezeigt
                  }
                } else if (isWeekendDay) {
                  cellClass = 'table-info';
                }

                return (
                  <td key={day.getDate()} className={`text-center p-1 ${cellClass}`}>
                    {badge}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};