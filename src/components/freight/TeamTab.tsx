import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "../ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Trash2, UserPlus } from "lucide-react";
import Select from 'react-select';
import type { ChatUser } from "@/types/chat";

type TeamMember = {
  user_id: string;
  profiles: { first_name: string | null, last_name: string | null } | null;
};

const fetchTeam = async (orderId: number): Promise<TeamMember[]> => {
  const { data, error } = await supabase
    .from('order_team_members')
    .select('user_id, profiles(first_name, last_name)')
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

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??';
  };

  const userOptions = allUsers
    ?.filter(u => !team?.some(m => m.user_id === u.id))
    .map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''}`.trim() })) || [];

  if (!orderId) {
    return (
      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Bitte speichern Sie den Auftrag zuerst, um ein Team zuzuweisen.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Team</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          <Select
            options={userOptions}
            onChange={(option) => option && addMutation.mutate(option.value)}
            isLoading={isLoadingUsers || addMutation.isPending}
            placeholder="Benutzer zum Team hinzufügen..."
            className="flex-grow"
            noOptionsMessage={() => 'Alle Benutzer sind bereits im Team'}
          />
        </div>
        <div className="space-y-2">
          {isLoadingTeam && <Skeleton className="h-12 w-full" />}
          {team?.map(member => (
            <div key={member.user_id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${member.profiles?.first_name} ${member.profiles?.last_name}`} />
                  <AvatarFallback>{getInitials(member.profiles?.first_name, member.profiles?.last_name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{`${member.profiles?.first_name || ''} ${member.profiles?.last_name || ''}`.trim()}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(member.user_id)} disabled={removeMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {!isLoadingTeam && team?.length === 0 && <p className="text-muted-foreground text-center">Noch keine Teammitglieder zugewiesen.</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamTab;