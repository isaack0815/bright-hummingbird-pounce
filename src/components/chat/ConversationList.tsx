import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Conversation } from '@/types/chat';
import { Placeholder, Image } from 'react-bootstrap';

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

  return (
    <div className="flex-grow-1" style={{ overflowY: 'auto' }}>
      {isLoading && Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="d-flex align-items-center gap-3 p-3">
          <Placeholder animation="glow"><Placeholder xs={12} style={{ width: 40, height: 40, borderRadius: '50%' }} /></Placeholder>
          <div className="flex-grow-1">
            <Placeholder animation="glow"><Placeholder xs={6} /></Placeholder>
            <Placeholder animation="glow"><Placeholder xs={8} /></Placeholder>
          </div>
        </div>
      ))}
      {conversations?.map((convo) => (
        <div
          key={convo.conversation_id}
          className="d-flex align-items-center gap-3 p-3 hover-bg-light cursor-pointer"
          onClick={() => onSelectConversation(convo)}
        >
          <div className="position-relative">
            <Image src={`https://api.dicebear.com/8.x/initials/svg?seed=${convo.other_user_first_name} ${convo.other_user_last_name}`} roundedCircle style={{ width: 40, height: 40 }} />
            {onlineUsers.includes(convo.other_user_id) && (
              <span className="position-absolute bottom-0 end-0 p-1 bg-success border border-light rounded-circle" />
            )}
          </div>
          <div className="flex-grow-1 overflow-hidden">
            <p className="fw-semibold text-truncate mb-0">
              {`${convo.other_user_first_name || ''} ${convo.other_user_last_name || ''}`.trim() || 'Unbekannter Benutzer'}
            </p>
            <p className="small text-muted text-truncate mb-0">{convo.last_message_content || 'Keine Nachrichten'}</p>
          </div>
        </div>
      ))}
      {!isLoading && conversations?.length === 0 && (
        <p className="p-4 text-center text-muted">Keine Konversationen. Starten Sie eine neue!</p>
      )}
    </div>
  );
};