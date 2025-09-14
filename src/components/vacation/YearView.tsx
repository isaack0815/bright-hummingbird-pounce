import { useMemo } from 'react';
import { Table } from 'react-bootstrap';
import { format, getDaysInMonth, isWithinInterval, parseISO, isWeekend, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import type { UserVacations } from '@/types/vacation';

type YearViewProps = {
  year: number;
  data: UserVacations[];
};

const MonthDays = ({ month, year, vacations }: { month: number, year: number, vacations: UserVacations['vacations'] }) => {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const dayBlocks = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const currentDate = startOfDay(new Date(year, month, day));
    const isVacation = vacations.some(v => 
      isWithinInterval(currentDate, { start: parseISO(v.start), end: parseISO(v.end) })
    );
    const isWeekendDay = isWeekend(currentDate);

    let bgColor = 'bg-light';
    if (isVacation) bgColor = 'bg-primary';
    else if (isWeekendDay) bgColor = 'bg-secondary-subtle';

    return (
      <div 
        key={day} 
        title={format(currentDate, 'dd.MM.yyyy')} 
        style={{ flex: '1 1 0%', height: '24px' }} 
        className={`border-start ${bgColor}`}
      ></div>
    );
  });

  return <div className="d-flex h-100">{dayBlocks}</div>;
};

export const YearView = ({ year, data }: YearViewProps) => {
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);

  return (
    <Table bordered responsive className="bg-white">
      <thead>
        <tr>
          <th style={{ minWidth: '150px' }}>Mitarbeiter</th>
          {months.map(month => (
            <th key={month.getMonth()} className="text-center" style={{ minWidth: '120px' }}>
              {format(month, 'MMMM', { locale: de })}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(user => (
          <tr key={user.userId}>
            <td className="fw-medium align-middle">{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</td>
            {months.map(month => (
              <td key={month.getMonth()} className="p-0 align-middle">
                <MonthDays month={month.getMonth()} year={year} vacations={user.vacations} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};