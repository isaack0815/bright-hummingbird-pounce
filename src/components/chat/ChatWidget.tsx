import { useState, useEffect } from 'react';
import { MessageCircle, X, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConversationList } from './ConversationList';
import { UserSearch } from './UserSearch';
import type { Conversation, ChatMessage } from '@/types/chat';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { showSuccess } from '@/utils/toast';

type View = 'list' | 'conversation' | 'search';

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        const presenceChannel = supabase.channel('online-users', {
          config: {
            presence: {
              key: user.id,
            },
          },
        });

        presenceChannel.on('presence', { event: 'sync' }, () => {
          const userIds = Object.keys(presenceChannel.presenceState()).map(key => key);
          setOnlineUsers(userIds);
        });

        presenceChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ online_at: new Date().toISOString() });
          }
        });
      }
    });

    const messageSubscription = supabase
      .channel('public-chat-messages-subscription')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['chatMessages', newMessage.conversation_id] });

          if (newMessage.user_id !== currentUserId) {
            showSuccess(`Neue Nachricht erhalten!`);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeAllChannels();
    }
  }, [queryClient, currentUserId]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setView('conversation');
  };

  const handleStartNewConversation = (user: any) => {
     const newConversation: Conversation = {
      conversation_id: user.conversation_id,
      other_user_id: user.other_user_id,
      other_user_first_name: user.other_user_first_name,
      other_user_last_name: user.other_user_last_name,
      last_message_content: null,
      last_message_created_at: null,
    };
    setSelectedConversation(newConversation);
    setView('conversation');
  }

  const renderHeader = () => {
    switch (view) {
      case 'conversation':
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setView('list')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h3 className="font-semibold truncate">
              {`${selectedConversation?.other_user_first_name || ''} ${selectedConversation?.other_user_last_name || ''}`.trim() || 'Chat'}
            </h3>
          </div>
        );
      case 'search':
        return (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setView('list')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h3 className="font-semibold">Neue Nachricht</h3>
          </div>
        );
      case 'list':
      default:
        return (
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h3 className="font-semibold">Chat</h3>
          </div>
        );
    }
  };

  const renderContent = () => {
    if (!isOpen) return null;
    switch (view) {
      case 'conversation':
        return selectedConversation && (
          <>
            <MessageList conversationId={selectedConversation.conversation_id} currentUserId={currentUserId} />
            <MessageInput conversationId={selectedConversation.conversation_id} />
          </>
        );
      case 'search':
        return <UserSearch onlineUsers={onlineUsers} onUserSelected={handleStartNewConversation} currentUserId={currentUserId} />;
      case 'list':
      default:
        return <ConversationList onSelectConversation={handleSelectConversation} onlineUsers={onlineUsers} />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen && (
        <Button onClick={() => setIsOpen(true)} size="lg" className="rounded-full shadow-lg">
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
      {isOpen && (
        <div className="bg-card border rounded-lg shadow-xl w-80 md:w-96 flex flex-col h-[32rem]">
          <header className="p-3 flex justify-between items-center border-b">
            {renderHeader()}
            <div className="flex items-center">
              {view === 'list' && (
                <Button variant="ghost" size="icon" onClick={() => setView('search')}>
                  <Search className="h-5 w-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
};