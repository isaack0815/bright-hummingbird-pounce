import { useMemo, useRef, useEffect, useState } from 'react';
import { Table, Button } from 'react-bootstrap';
import { format, getDaysInMonth, isWithinInterval, parseISO, isWeekend, differenceInCalendarDays } from 'date-fns';
import type { VacationRequest } from '@/types/vacation';
import type { ChatUser } from '@/types/chat';
import { Trash2 } from 'lucide-react';

type MonthlyVacationTableProps = {
  year: number;
  month: number;
  requests: VacationRequest[];
  users: ChatUser[];
  onCellClick: (userId: string, date: Date) => void;
  onDeleteRequest: (requestId: number) => void;
};

export const MonthlyVacationTable = ({ year, month, requests, users, onCellClick, onDeleteRequest }: MonthlyVacationTableProps) => {
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const [cellWidth, setCellWidth] = useState(35);
  const [firstColWidth, setFirstColWidth] = useState(150);
  const [hoveredVacationId, setHoveredVacationId] = useState<number | null>(null);

  useEffect(() => {
    const calculateWidths = () => {
      if (headerRef.current) {
        const firstTh = headerRef.current.querySelector('th:first-child') as HTMLElement;
        const secondTh = headerRef.current.querySelector('th:nth-child(2)') as HTMLElement;
        if (firstTh) setFirstColWidth(firstTh.offsetWidth);
        if (secondTh) setCellWidth(secondTh.offsetWidth);
      }
    };
    calculateWidths();
    const resizeObserver = new ResizeObserver(calculateWidths);
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [year, month]);

  const daysInMonth = useMemo(() => {
    const date = new Date(year, month, 1);
    const days = getDaysInMonth(date);
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }, [year, month]);

  const processedData = useMemo(() => {
    const requestsMap = new Map<string, VacationRequest[]>();
    requests.forEach(req => {
      if (!requestsMap.has(req.user_id)) {
        requestsMap.set(req.user_id, []);
      }
      requestsMap.get(req.user_id)!.push(req);
    });

    return users.map(user => ({
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      vacations: requestsMap.get(user.id) || [],
    })).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [requests, users]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success';
      case 'pending': return 'bg-warning';
      case 'rejected': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  return (
    <div className="table-responsive">
      <Table bordered className="bg-white vacation-table mb-0">
        <thead ref={headerRef}>
          <tr>
            <th className="sticky-col">Angestellter</th>
            {daysInMonth.map(day => (
              <th key={day.getDate()} className={`text-center p-1 ${isWeekend(day) ? 'table-info' : ''}`} style={{minWidth: '35px'}}>
                {format(day, 'd')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedData.map(user => (
            <tr key={user.userId} style={{ position: 'relative', height: '40px' }}>
              <td className="fw-medium sticky-col">
                {`${user.firstName || ''} ${user.lastName || ''}`.trim()}
              </td>
              {daysInMonth.map(day => (
                <td 
                  key={day.getDate()} 
                  className={`text-center p-1 ${isWeekend(day) ? 'table-info' : ''}`}
                  onClick={() => onCellClick(user.userId, day)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
              {user.vacations.map(vacation => {
                const start = parseISO(vacation.start_date);
                const end = parseISO(vacation.end_date);
                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month, daysInMonth.length);

                if (end < monthStart || start > monthEnd) return null;

                const effectiveStart = start < monthStart ? monthStart : start;
                const effectiveEnd = end > monthEnd ? monthEnd : end;
                
                const left = firstColWidth + (effectiveStart.getDate() - 1) * cellWidth;
                const duration = differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
                const width = duration * cellWidth - 2;

                return (
                  <div
                    key={vacation.id}
                    className={`position-absolute rounded-pill text-white small d-flex align-items-center justify-content-center px-2 vacation-bar ${getStatusClass(vacation.status)}`}
                    style={{
                      top: '5px',
                      left: `${left + 1}px`,
                      width: `${width}px`,
                      height: '30px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={() => setHoveredVacationId(vacation.id)}
                    onMouseLeave={() => setHoveredVacationId(null)}
                    title={`${format(start, 'dd.MM')} - ${format(end, 'dd.MM')}`}
                  >
                    <span>{vacation.status === 'pending' ? 'Beantragt' : 'Urlaub'}</span>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0 text-white position-absolute end-0 me-2 vacation-bar-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Möchten Sie diesen Eintrag wirklich löschen?")) {
                          onDeleteRequest(vacation.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};