import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Container, Row, Col, Card, Spinner, Alert, Image } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import { Tree, TreeNode } from 'react-organizational-chart';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { showError, showSuccess } from '@/utils/toast';

type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  manager_id: string | null;
};

type TreeNodeData = User & { children: TreeNodeData[] };

const fetchUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.functions.invoke('get-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const buildTree = (users: User[]): TreeNodeData[] => {
  if (!users || users.length === 0) {
    return [];
  }
  
  const userMap = new Map<string, TreeNodeData>();
  const allUserIds = new Set(users.map(u => u.id));

  // Initialize map for every user
  users.forEach(user => {
    userMap.set(user.id, { ...user, children: [] });
  });

  // Link children to parents
  users.forEach(user => {
    if (user.manager_id && allUserIds.has(user.manager_id)) {
      const manager = userMap.get(user.manager_id);
      if (manager) {
        manager.children.push(userMap.get(user.id)!);
      }
    }
  });

  // Find roots: users whose manager_id is null, or points to a non-existent user
  const roots = users
    .filter(user => !user.manager_id || !allUserIds.has(user.manager_id))
    .map(user => userMap.get(user.id)!);
    
  return roots;
};

const DraggableUser = ({ user }: { user: User }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: user.id,
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }} className="p-2 border rounded mb-2 bg-light d-flex align-items-center">
      <UserIcon size={16} className="me-2" />
      {user.first_name} {user.last_name}
    </div>
  );
};

const ChartNode = ({ user }: { user: TreeNodeData }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: user.id,
  });

  return (
    <div ref={setNodeRef} style={{ backgroundColor: isOver ? '#e0e7ff' : 'white', transition: 'background-color 0.2s' }}>
      <div className="d-flex flex-column align-items-center p-2 border rounded shadow-sm">
        <Image src={`https://api.dicebear.com/8.x/initials/svg?seed=${user.first_name} ${user.last_name}`} roundedCircle width={40} height={40} className="mb-2" />
        <div className="fw-bold small">{user.first_name} {user.last_name}</div>
      </div>
    </div>
  );
};

const renderTree = (nodes: TreeNodeData[]) => {
  return nodes.map(node => (
    <TreeNode key={node.id} label={<ChartNode user={node} />}>
      {node.children.length > 0 && renderTree(node.children)}
    </TreeNode>
  ));
};

const OrganizationChart = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const updateManagerMutation = useMutation({
    mutationFn: async ({ userId, managerId }: { userId: string, managerId: string | null }) => {
      const { error } = await supabase.functions.invoke('action', {
        body: { action: 'update-user-manager', payload: { userId, managerId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Vorgesetzter erfolgreich zugewiesen!");
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => showError(err.message || "Fehler bei der Zuweisung."),
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      updateManagerMutation.mutate({ userId: active.id, managerId: over.id });
    }
  };

  const tree = useMemo(() => {
    if (!users) return [];
    return buildTree(users);
  }, [users]);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Container fluid>
        <div className="d-flex align-items-center gap-3 mb-4">
          <NavLink to="/users" className="btn btn-outline-secondary p-2 lh-1"><ArrowLeft size={16} /></NavLink>
          <h1 className="h2 mb-0">Organigramm</h1>
        </div>

        {error && <Alert variant="danger">Fehler beim Laden der Benutzer: {error.message}</Alert>}
        {isLoading && <div className="text-center p-5"><Spinner /></div>}

        {users && (
          <Row>
            <Col md={3}>
              <Card>
                <Card.Header>Mitarbeiter</Card.Header>
                <Card.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {users.map(user => <DraggableUser key={user.id} user={user} />)}
                </Card.Body>
              </Card>
            </Col>
            <Col md={9}>
              <Card>
                <Card.Header>Hierarchie</Card.Header>
                <Card.Body style={{ overflowX: 'auto' }}>
                  <Tree
                    lineWidth={'2px'}
                    lineColor={'#dee2e6'}
                    lineBorderRadius={'10px'}
                    label="Organigramm"
                  >
                    {renderTree(tree)}
                  </Tree>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </DndContext>
  );
};

export default OrganizationChart;