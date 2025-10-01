import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Placeholder, Alert } from "react-bootstrap";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

type HistoryEntry = {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const fetchHistory = async (orderId: number): Promise<HistoryEntry[]> => {
  const { data, error } = await supabase.functions.invoke('get-order-status-history', {
    body: { orderId },
  });
  if (error) throw error;
  return data.history;
};

const StatusHistoryTab = ({ orderId }: { orderId: number | null }) => {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['orderStatusHistory', orderId],
    queryFn: () => fetchHistory(orderId!),
    enabled: !!orderId,
  });

  if (!orderId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <Card.Header><Card.Title>Verlauf</Card.Title></Card.Header>
        <Card.Body>
          <Placeholder animation="glow">
            <Placeholder xs={12} style={{ height: '50px' }} className="mb-2" />
            <Placeholder xs={12} style={{ height: '50px' }} className="mb-2" />
            <Placeholder xs={12} style={{ height: '50px' }} />
          </Placeholder>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Card.Header><Card.Title>Verlauf</Card.Title></Card.Header>
        <Card.Body>
          <Alert variant="danger">Fehler beim Laden des Verlaufs: {error.message}</Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header><Card.Title>Statusverlauf</Card.Title></Card.Header>
      <Card.Body>
        {history && history.length > 0 ? (
          <ul className="list-unstyled">
            {history.map(entry => (
              <li key={entry.id} className="mb-3 pb-3 border-bottom">
                <div className="d-flex justify-content-between align-items-center">
                  <p className="mb-1">
                    Status geändert von <span className="fw-bold">{entry.old_status || 'Kein'}</span> zu <span className="fw-bold">{entry.new_status}</span>
                  </p>
                  <span className="small text-muted">
                    {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true, locale: de })}
                  </span>
                </div>
                <p className="small text-muted mb-0">
                  durch {`${entry.profiles?.first_name || ''} ${entry.profiles?.last_name || ''}`.trim() || 'Unbekannt'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-center">Kein Statusverlauf für diesen Auftrag vorhanden.</p>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatusHistoryTab;