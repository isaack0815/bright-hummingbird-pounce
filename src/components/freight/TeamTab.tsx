import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, Button, Placeholder, Image } from "react-bootstrap";
import { showError, showSuccess } from "@/utils/toast";
import { Trash2, UserPlus } from "lucide-react";
import Select from 'react-select';
import type { ChatUser } from "@/types/chat";

type TeamMember = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchTeam = async (orderId: number): Promise<TeamMember[]> => {
  const { data, error } = await supabase
    .from('order_team_members_with_profile')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;
  return data;
};

const fetchAllUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

const TeamTab = ({ orderId }: { orderId: number | null }) => {
  const queryClient = useQueryClient();

  const { data: team, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['orderTeam', orderId],
    queryFn: () => fetchTeam(orderId!),
    enabled: !!orderId,
  });

  const { data: allUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['chatUsers'],
    queryFn: fetchAllUsers,
  });

  const addMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('order_team_members').insert({ order_id: orderId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderTeam', orderId] });
      showSuccess("Benutzer zum Team hinzugefügt!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Hinzufügen."),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('order_team_members').delete().match({ order_id: orderId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderTeam', orderId] });
      showSuccess("Benutzer aus dem Team entfernt!");
    },
    onError: (err: any) => showError(err.message || "Fehler beim Entfernen."),
  });

  const userOptions = allUsers
    ?.filter(u => !team?.some(m => m.user_id === u.id))
    .map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() })) || [];

  if (!orderId) {
    return (
      <Card>
        <Card.Header><Card.Title>Team</Card.Title></Card.Header>
        <Card.Body><p className="text-muted">Bitte speichern Sie den Auftrag zuerst, um ein Team zuzuweisen.</p></Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header><Card.Title>Team</Card.Title></Card.Header>
      <Card.Body className="d-flex flex-column gap-4">
        <div className="d-flex align-items-center gap-2">
          <UserPlus className="h-5 w-5 text-muted" />
          <Select
            options={userOptions}
            onChange={(option) => option && addMutation.mutate(option.value)}
            isLoading={isLoadingUsers || addMutation.isPending}
            placeholder="Benutzer zum Team hinzufügen..."
            className="flex-grow-1"
            noOptionsMessage={() => 'Alle Benutzer sind bereits im Team'}
          />
        </div>
        <div className="d-flex flex-column gap-2">
          {isLoadingTeam && <Placeholder animation="glow"><Placeholder xs={12} style={{ height: '50px' }} /></Placeholder>}
          {team?.map(member => (
            <div key={member.user_id} className="d-flex align-items-center justify-content-between rounded border p-3">
              <div className="d-flex align-items-center gap-3">
                <Image src={`https://api.dicebear.com/8.x/initials/svg?seed=${member.first_name} ${member.last_name}`} roundedCircle style={{ width: 32, height: 32 }} />
                <span className="fw-medium">{`${member.first_name || ''} ${member.last_name || ''}`.trim()}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(member.user_id)} disabled={removeMutation.isPending}><Trash2 className="h-4 w-4 text-danger" /></Button>
            </div>
          ))}
          {!isLoadingTeam && team?.length === 0 && <p className="text-muted text-center">Noch keine Teammitglieder zugewiesen.</p>}
        </div>
      </Card.Body>
    </Card>
  );
};

export default TeamTab;