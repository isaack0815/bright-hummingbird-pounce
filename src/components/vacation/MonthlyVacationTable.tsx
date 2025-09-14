import { useMemo } from 'react';
import { Table, Badge } from 'react-bootstrap';
import { format, getDaysInMonth, isWithinInterval, parseISO, isWeekend, startOfDay } from 'date-fns';
import type { UserVacations } from '@/types/vacation';

type MonthlyVacationTableProps = {
  year: number;
  month: number; // 0-11
  data: UserVacations[];
};

export const MonthlyVacationTable = ({ year, month, data }: MonthlyVacationTableProps) => {
  const daysInMonth = useMemo(() => {
    const date = new Date(year, month, 1);
    const days = getDaysInMonth(date);
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }, [year, month]);

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
          {data.map(user => (
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
                if (vacation) cellClass = 'table-warning';
                else if (isWeekendDay) cellClass = 'table-info';

                return (
                  <td key={day.getDate()} className={`text-center p-1 ${cellClass}`}>
                    {vacation && <Badge bg="success" pill className="p-1">U</Badge>}
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