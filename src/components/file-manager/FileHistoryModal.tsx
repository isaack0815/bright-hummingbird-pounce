import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Spinner, Table } from 'react-bootstrap';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { OrderFileWithDetails, FileActivityLog } from '@/types/files';

type FileHistoryModalProps = {
  file: OrderFileWithDetails | null;
  show: boolean;
  onHide: () => void;
};

const fetchHistory = async (fileId: number): Promise<FileActivityLog[]> => {
  const { data, error } = await supabase.functions.invoke('get-file-history', {
    body: { fileId },
  });
  if (error) throw error;
  return data.history;
};

export const FileHistoryModal = ({ file, show, onHide }: FileHistoryModalProps) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ['fileHistory', file?.id],
    queryFn: () => fetchHistory(file!.id),
    enabled: !!file && show,
  });

  const renderDetails = (log: FileActivityLog) => {
    if (!log.details) return '-';
    switch (log.action) {
      case 'emailed':
        return `An: ${log.details.recipient}`;
      case 'reassigned':
        return `Von Auftrag ${log.details.from_order_id} zu ${log.details.to_order_id}`;
      case 'created':
        return `Originalname: ${log.details.original_filename}`;
      case 'downloaded':
        return `IP: ${log.details.ip}`;
      default:
        return JSON.stringify(log.details);
    }
  };

  if (!file) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Historie für: {file.file_name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {isLoading ? <Spinner /> : (
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>Aktion</th>
                <th>Benutzer</th>
                <th>Details</th>
                <th>Zeitpunkt</th>
              </tr>
            </thead>
            <tbody>
              {history?.map(log => (
                <tr key={log.id}>
                  <td className="text-capitalize">{log.action}</td>
                  <td>{`${log.profiles?.first_name || ''} ${log.profiles?.last_name || ''}`.trim()}</td>
                  <td>{renderDetails(log)}</td>
                  <td>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: de })}</td>
                </tr>
              ))}
              {history?.length === 0 && <tr><td colSpan={4} className="text-center text-muted">Keine Aktivitäten protokolliert.</td></tr>}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Schließen</Button>
      </Modal.Footer>
    </Modal>
  );
};