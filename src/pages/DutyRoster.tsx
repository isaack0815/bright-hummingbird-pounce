import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, ListGroup, Button, Spinner } from 'react-bootstrap';
import { PlusCircle } from 'lucide-react';
import { CreateRosterDialog } from '@/components/roster/CreateRosterDialog';
import { RosterGrid } from '@/components/roster/RosterGrid';

const fetchWorkGroupsWithRosters = async () => {
  const { data, error } = await supabase.functions.invoke('get-work-groups-with-rosters');
  if (error) throw error;
  return data.groups;
};

const DutyRoster = () => {
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['workGroupsWithRosters'],
    queryFn: fetchWorkGroupsWithRosters,
  });

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h2">Dienstplan</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle size={16} className="me-2" />
            Neuen Plan erstellen
          </Button>
        </div>
        <Row>
          <Col md={3}>
            <Card>
              <Card.Header>Arbeitsgruppen & Pläne</Card.Header>
              {isLoading ? <div className="p-3 text-center"><Spinner size="sm" /></div> : (
                <ListGroup variant="flush">
                  {groups?.map((group: any) => (
                    <div key={group.id}>
                      <ListGroup.Item className="fw-bold bg-light">{group.name}</ListGroup.Item>
                      {group.duty_rosters.map((roster: any) => (
                        <ListGroup.Item 
                          key={roster.id} 
                          action 
                          active={roster.id === selectedRosterId}
                          onClick={() => setSelectedRosterId(roster.id)}
                        >
                          {new Date(roster.start_date).toLocaleDateString()} - {new Date(roster.end_date).toLocaleDateString()}
                        </ListGroup.Item>
                      ))}
                    </div>
                  ))}
                </ListGroup>
              )}
            </Card>
          </Col>
          <Col md={9}>
            {selectedRosterId ? (
              <RosterGrid rosterId={selectedRosterId} />
            ) : (
              <Card className="h-100">
                <Card.Body className="d-flex justify-content-center align-items-center">
                  <p className="text-muted">Bitte wählen Sie einen Dienstplan aus oder erstellen Sie einen neuen.</p>
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
      </Container>
      <CreateRosterDialog show={isCreateDialogOpen} onHide={() => setIsCreateDialogOpen(false)} />
    </>
  );
};

export default DutyRoster;