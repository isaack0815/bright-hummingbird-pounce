import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Placeholder, ListGroup, Badge } from "react-bootstrap";
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { GitCommitVertical } from "lucide-react";

type HistoryItem = {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const fetchHistory = async (orderId: number): Promise<HistoryItem[]> => {
  const { data, error } = await supabase.functions.invoke('get-order-status-history', {
    body: { orderId },
  });
  if (error) throw error;
  return data.history;
};

const StatusHistoryTab = ({ orderId }: { orderId: number | null }) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ['orderStatusHistory', orderId],
    queryFn: () => fetchHistory(orderId!),
    enabled: !!orderId,
  });

  if (!orderId) {
    return null;
  }

  return (
    <Card>
      <Card.Header><Card.Title>Status-Verlauf</Card.Title></Card.Header>
      <Card.Body>
        {isLoading && <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '100px' }} /></Placeholder>}
        <ListGroup variant="flush">
          {history?.map(item => (
            <ListGroup.Item key={item.id} className="d-flex align-items-start gap-3">
              <GitCommitVertical className="mt-1 text-muted" />
              <div className="flex-grow-1">
                <p className="mb-1">
                  Status geändert von <Badge bg="light" text="dark" className="border">{item.old_status || 'Kein'}</Badge> zu <Badge bg="secondary">{item.new_status}</Badge>
                </p>
                <p className="small text-muted mb-0">
                  von {`${item.profiles?.first_name || ''} ${item.profiles?.last_name || ''}`.trim() || 'System'}
                  {' • '}
                  {formatDistanceToNow(new Date(item.changed_at), { addSuffix: true, locale: de })}
                </p>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
        {!isLoading && history?.length === 0 && <p className="text-muted text-center">Noch keine Statusänderungen vorhanden.</p>}
      </Card.Body>
    </Card>
  );
};

export default StatusHistoryTab;