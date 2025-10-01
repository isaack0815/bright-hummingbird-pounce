import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Form, Spinner, ListGroup, Badge } from 'react-bootstrap';
import Select from 'react-select';
import { showError, showSuccess } from '@/utils/toast';
import type { UserFile } from '@/types/personal-files';
import type { ChatUser } from '@/types/chat';
import { X } from 'lucide-react';

type Share = {
  shared_with_user_id: string;
  profiles: { first_name: string | null; last_name: string | null; };
};

type ShareFileDialogProps = {
  file: UserFile | null;
  show: boolean;
  onHide: () => void;
};

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const fetchShares = async (fileId: number): Promise<Share[]> => {
  const { data, error } = await supabase.functions.invoke('action', {
    body: { action: 'get-file-shares', payload: { fileId } }
  });
  if (error) throw error;
  return data.shares;
};

export const ShareFileDialog = ({ file, show, onHide }: ShareFileDialogProps) => {
  const queryClient = useQueryClient();

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
    enabled: show,
  });

  const { data: shares, isLoading: isLoadingShares } = useQuery({
    queryKey: ['fileShares', file?.id],
    queryFn: () => fetchShares(file!.id),
    enabled: !!file && show,
  });

  const shareMutation = useMutation({
    mutationFn: async (userIdToShareWith: string) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'share-file', payload: { fileId: file!.id, userIdToShareWith } }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Datei freigegeben!");
      queryClient.invalidateQueries({ queryKey: ['fileShares', file?.id] });
    },
    onError: (err: any) => showError(err.message),
  });

  const unshareMutation = useMutation({
    mutationFn: async (userIdToUnshare: string) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'unshare-file', payload: { fileId: file!.id, userIdToUnshare } }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Freigabe entfernt.");
      queryClient.invalidateQueries({ queryKey: ['fileShares', file?.id] });
    },
    onError: (err: any) => showError(err.message),
  });

  const userOptions = users
    ?.filter(u => !shares?.some(s => s.shared_with_user_id === u.id))
    .map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() })) || [];

  if (!file) return null;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>"{file.file_name}" freigeben</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Für neuen Benutzer freigeben</Form.Label>
          <Select
            options={userOptions}
            isLoading={isLoadingUsers}
            onChange={(opt: any) => opt && shareMutation.mutate(opt.value)}
            placeholder="Benutzer auswählen..."
            value={null}
          />
        </Form.Group>
        <hr />
        <h6>Bereits freigegeben für:</h6>
        {isLoadingShares ? <Spinner size="sm" /> : (
          <ListGroup>
            {shares?.map(share => (
              <ListGroup.Item key={share.shared_with_user_id} className="d-flex justify-content-between align-items-center">
                {`${share.profiles.first_name || ''} ${share.profiles.last_name || ''}`.trim()}
                <Button variant="link" size="sm" className="text-danger" onClick={() => unshareMutation.mutate(share.shared_with_user_id)}>
                  <X size={16} />
                </Button>
              </ListGroup.Item>
            ))}
            {shares?.length === 0 && <p className="text-muted small">Noch für niemanden freigegeben.</p>}
          </ListGroup>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Schließen</Button>
      </Modal.Footer>
    </Modal>
  );
};