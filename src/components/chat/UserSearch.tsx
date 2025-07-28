import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Select from 'react-select';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';
import type { ChatUser } from '@/types/chat';

type UserSearchProps = {
  onlineUsers: string[];
  onUserSelected: (conversation: any) => void;
  currentUserId: string | null;
};

const fetchUsers = async (): Promise<ChatUser[]> => {
  const { data, error } = await supabase.functions.invoke('get-chat-users');
  if (error) throw new Error(error.message);
  return data.users;
};

export const UserSearch = ({ onlineUsers, onUserSelected, currentUserId }: UserSearchProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const { data: users, isLoading } = useQuery<ChatUser[]>({
    queryKey: ['chatUsers'],
    queryFn: fetchUsers,
  });

  const options = users
    ?.filter(user => user.id !== currentUserId)
    .map(user => ({
      value: user.id,
      label: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    })) || [];

  const handleSelectUser = async (selectedOption: any) => {
    if (!selectedOption) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-or-create-conversation', {
        body: { target_user_id: selectedOption.value },
      });
      if (error) throw error;
      showSuccess(`Konversation mit ${selectedOption.label} gestartet!`);
      onUserSelected(data.conversation);
    } catch (err: any) {
      showError(err.message || 'Fehler beim Starten der Konversation.');
    } finally {
      setIsCreating(false);
    }
  };

  const formatOptionLabel = ({ label, value }: { label: string, value: string }) => (
    <div className="flex items-center">
      {label}
      {onlineUsers.includes(value) && <span className="ml-2 h-2 w-2 rounded-full bg-green-500" />}
    </div>
  );

  return (
    <div className="p-4">
      <Select
        options={options}
        onChange={handleSelectUser}
        isLoading={isLoading || isCreating}
        isDisabled={isLoading || isCreating}
        placeholder="Suchen Sie nach einem Benutzer..."
        formatOptionLabel={formatOptionLabel}
        noOptionsMessage={() => 'Keine Benutzer gefunden'}
      />
    </div>
  );
};