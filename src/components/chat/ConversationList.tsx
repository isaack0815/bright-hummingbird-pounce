import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Conversation } from '@/types/chat';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type ConversationListProps = {
  onSelectConversation: (conversation: Conversation) => void;
  onlineUsers: string[];
};

const fetchConversations = async (): Promise<Conversation[]> => {
  const { data, error } = await supabase.functions.invoke('get-my-conversations');
  if (error) throw new Error(error.message);
  return data.conversations;
};

export const ConversationList = ({ onSelectConversation, onlineUsers }: ConversationListProps) => {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??';
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {isLoading && Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-2/4" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
      {conversations?.map((convo) => (
        <div
          key={convo.conversation_id}
          className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
          onClick={() => onSelectConversation(convo)}
        >
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${convo.other_user_first_name} ${convo.other_user_last_name}`} />
              <AvatarFallback>{getInitials(convo.other_user_first_name, convo.other_user_last_name)}</AvatarFallback>
            </Avatar>
            {onlineUsers.includes(convo.other_user_id) && (
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-semibold truncate">{convo.other_user_first_name} {convo.other_user_last_name}</p>
            <p className="text-sm text-muted-foreground truncate">{convo.last_message_content || 'Keine Nachrichten'}</p>
          </div>
        </div>
      ))}
      {!isLoading && conversations?.length === 0 && (
        <p className="p-4 text-center text-muted-foreground">Keine Konversationen. Starten Sie eine neue!</p>
      )}
    </div>
  );
};