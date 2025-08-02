import { useState, useEffect } from 'react';
import { MessageCircle, X, Search, ArrowLeft } from 'lucide-react';
import { Button } from 'react-bootstrap';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConversationList } from './ConversationList';
import { UserSearch } from './UserSearch';
import type { Conversation, ChatMessage } from '@/types/chat';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { showError, showSuccess } from '@/utils/toast';

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
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUserId,
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
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(messageSubscription);
    }
  }, [currentUserId, queryClient]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setView('conversation');
  };

  const handleStartNewConversation = (conversationData: any) => {
    if (!conversationData || !conversationData.conversation_id) {
      showError("Konversation konnte nicht gestartet werden.");
      console.error("handleStartNewConversation received invalid data:", conversationData);
      return;
    }
     const newConversation: Conversation = {
      conversation_id: conversationData.conversation_id,
      other_user_id: conversationData.other_user_id,
      other_user_first_name: conversationData.other_user_first_name,
      other_user_last_name: conversationData.other_user_last_name,
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
          <div className="d-flex align-items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView('list')}>
              <ArrowLeft size={20} />
            </Button>
            <h3 className="h6 mb-0 text-truncate">
              {`${selectedConversation?.other_user_first_name || ''} ${selectedConversation?.other_user_last_name || ''}`.trim() || 'Chat'}
            </h3>
          </div>
        );
      case 'search':
        return (
          <div className="d-flex align-items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView('list')}>
              <ArrowLeft size={20} />
            </Button>
            <h3 className="h6 mb-0">Neue Nachricht</h3>
          </div>
        );
      case 'list':
      default:
        return (
          <div className="d-flex align-items-center gap-2">
            <MessageCircle className="text-primary" size={24} />
            <h3 className="h6 mb-0">Chat</h3>
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
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 1050 }}>
      {!isOpen && (
        <Button onClick={() => setIsOpen(true)} size="lg" className="rounded-circle shadow-lg p-3">
          <MessageCircle size={24} />
        </Button>
      )}
      {isOpen && (
        <div className="card shadow-xl" style={{ width: '24rem', height: '32rem', display: 'flex', flexDirection: 'column' }}>
          <header className="card-header p-3 d-flex justify-content-between align-items-center">
            {renderHeader()}
            <div className="d-flex align-items-center">
              {view === 'list' && (
                <Button variant="ghost" size="sm" onClick={() => setView('search')}>
                  <Search size={20} />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </Button>
            </div>
          </header>
          <div className="flex-grow-1 d-flex flex-column" style={{ overflow: 'hidden' }}>
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
};