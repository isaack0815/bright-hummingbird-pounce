import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Modal, Button, Form } from 'react-bootstrap';
import Select from 'react-select';

type Member = { id: string; first_name: string | null; last_name: string | null; };

type AssignUsersToTourDialogProps = {
  show: boolean;
  onHide: () => void;
  tourName: string;
  availableMembers: Member[];
  selectedUserIds: string[];
  onSave: (newUserIds: string[]) => void;
  unavailableUserIds: string[];
};

export function AssignUsersToTourDialog({ show, onHide, tourName, availableMembers, selectedUserIds, onSave, unavailableUserIds }: AssignUsersToTourDialogProps) {
  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      userIds: [] as { value: string; label: string }[],
    },
  });

  useEffect(() => {
    if (show) {
      const preselected = availableMembers
        .filter(m => selectedUserIds.includes(m.id))
        .map(m => ({ value: m.id, label: `${m.first_name || ''} ${m.last_name || ''}`.trim() }));
      reset({ userIds: preselected });
    }
  }, [show, selectedUserIds, availableMembers, reset]);

  const memberOptions = availableMembers.map(m => ({
    value: m.id,
    label: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
  }));

  const onSubmit = (data: { userIds: { value: string }[] }) => {
    onSave(data.userIds.map(u => u.value));
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Benutzer für "{tourName}" zuweisen</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Mitarbeiter auswählen</Form.Label>
            <Controller
              name="userIds"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  isMulti
                  options={memberOptions}
                  placeholder="Mitarbeiter auswählen..."
                  classNamePrefix="select"
                  isOptionDisabled={(option) => unavailableUserIds.includes(option.value)}
                />
              )}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Abbrechen</Button>
          <Button type="submit">Speichern</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}