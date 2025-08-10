import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Card, Button, Spinner, Form } from 'react-bootstrap';
import { PlusCircle } from 'lucide-react';
import { CreateRosterDialog } from '@/components/roster/CreateRosterDialog';
import { RosterCalendar } from '@/components/roster/RosterCalendar';
import type { WorkGroup } from '@/types/workgroup';

const fetchWorkGroups = async (): Promise<WorkGroup[]> => {
  const { data, error } = await supabase.functions.invoke('get-work-groups');
  if (error) throw error;
  return data.groups;
};

const DutyRoster = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['workGroups'],
    queryFn: fetchWorkGroups,
  });

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">Dienstplan</h1>
          <div className="d-flex align-items-center gap-3">
            {isLoading ? <Spinner size="sm" /> : (
              <Form.Select 
                style={{width: '250px'}} 
                onChange={(e) => setSelectedGroupId(Number(e.target.value) || null)}
                value={selectedGroupId || ''}
              >
                <option value="">Arbeitsgruppe auswählen...</option>
                {groups?.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </Form.Select>
            )}
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle size={16} className="me-2" />
              Neuen Plan erstellen
            </Button>
          </div>
        </div>
        
        {selectedGroupId ? (
          <RosterCalendar workGroupId={selectedGroupId} />
        ) : (
          <Card className="h-100">
            <Card.Body className="d-flex justify-content-center align-items-center" style={{minHeight: '60vh'}}>
              <p className="text-muted">Bitte wählen Sie eine Arbeitsgruppe aus, um den Dienstplan anzuzeigen.</p>
            </Card.Body>
          </Card>
        )}
      </Container>
      <CreateRosterDialog show={isCreateDialogOpen} onHide={() => setIsCreateDialogOpen(false)} />
    </>
  );
};

export default DutyRoster;