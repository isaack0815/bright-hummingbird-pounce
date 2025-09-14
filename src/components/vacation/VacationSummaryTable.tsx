import { useMemo } from 'react';
import { Table, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import type { VacationRequest, UserWithVacationDetails } from '@/types/vacation';
import TablePlaceholder from '@/components/TablePlaceholder';
import { Info } from 'lucide-react';

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
    const vacationDays = worksWeekends ? days.length : days.filter(day => !isWeekend(day)).length;
    totalDays += vacationDays;
  }
  return totalDays;
};

export const VacationSummaryTable = ({ users, requests, year, isLoading }: VacationSummaryTableProps) => {
  const summaryData = useMemo(() => {
    return users.map(user => {
      if (!user.entry_date || !user.vacation_days_per_year) {
        return {
          userId: user.id,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          carryOver: 0,
          entitlementCurrentYear: 0,
          takenCurrentYear: 0,
          remainingTotal: 0,
          previousYears: [],
        };
      }

      const userRequests = requests.filter(r => r.user_id === user.id && r.status === 'approved');
      const entryYear = parseISO(user.entry_date).getFullYear();
      
      let carryOver = 0;
      const previousYearsData: { year: number, balance: number }[] = [];

      for (let pastYear = entryYear; pastYear < year; pastYear++) {
        const entitlement = user.vacation_days_per_year;
        const taken = calculateTakenDays(userRequests, user.works_weekends, pastYear);
        const balance = entitlement - taken;
        carryOver += balance;
        if (balance > 0) {
          previousYearsData.push({ year: pastYear, balance });
        }
      }

      const entitlementCurrentYear = user.vacation_days_per_year;
      const takenCurrentYear = calculateTakenDays(userRequests, user.works_weekends, year);
      
      const totalEntitlement = carryOver + entitlementCurrentYear;
      const remainingTotal = totalEntitlement - takenCurrentYear;

      return {
        userId: user.id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        carryOver,
        entitlementCurrentYear,
        takenCurrentYear,
        remainingTotal,
        previousYears: previousYearsData,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, requests, year]);

  if (isLoading) {
    return <TablePlaceholder rows={5} cols={5} />;
  }

  const renderTooltip = (previousYears: { year: number, balance: number }[]) => (
    <Tooltip id="tooltip-previous-years">
      <div className="text-start">
        <strong>Resturlaub aus Vorjahren:</strong>
        <ul className="list-unstyled mb-0 ps-2">
          {previousYears.map(item => (
            <li key={item.year}>{item.year}: {item.balance} Tage</li>
          ))}
        </ul>
      </div>
    </Tooltip>
  );

  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>Mitarbeiter</th>
          <th>Rest (Vorjahre)</th>
          <th>Anspruch {year}</th>
          <th>Genommen {year}</th>
          <th>Gesamt Resturlaub</th>
        </tr>
      </thead>
      <tbody>
        {summaryData.map(row => (
          <tr key={row.userId}>
            <td>{row.name}</td>
            <td>
              {row.carryOver > 0 ? (
                <OverlayTrigger placement="top" overlay={renderTooltip(row.previousYears)}>
                  <span>{row.carryOver} Tage <Info size={14} className="ms-1 text-primary" /></span>
                </OverlayTrigger>
              ) : '0 Tage'}
            </td>
            <td>{row.entitlementCurrentYear > 0 ? `${row.entitlementCurrentYear} Tage` : '-'}</td>
            <td>{row.takenCurrentYear} Tage</td>
            <td className={row.remainingTotal < 0 ? 'text-danger fw-bold' : ''}>
              {row.entitlementCurrentYear > 0 ? `${row.remainingTotal} Tage` : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};