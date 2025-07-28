import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types/chat';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Download } from 'lucide-react';

type MessageListProps = {
  onNewMessage: (message: ChatMessage) => void;
};

const fetchMessages = async (): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, profiles(id, first_name, last_name)')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as ChatMessage[];
};

export const MessageList = ({ onNewMessage }: MessageListProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['chatMessages'],
    queryFn: fetchMessages,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('id', newMessage.user_id)
            .single();
          
          newMessage.profiles = profile;
          setMessages((prev) => [...prev, newMessage]);
          onNewMessage(newMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??';
  };

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-end gap-2 ${msg.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}
        >
          {msg.user_id !== currentUserId && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${msg.profiles?.first_name} ${msg.profiles?.last_name}`} />
              <AvatarFallback>{getInitials(msg.profiles?.first_name, msg.profiles?.last_name)}</AvatarFallback>
            </Avatar>
          )}
          <div
            className={`max-w-xs rounded-lg px-3 py-2 ${
              msg.user_id === currentUserId ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            {msg.user_id !== currentUserId && (
              <p className="text-xs font-semibold mb-1">
                {msg.profiles?.first_name || 'Benutzer'}
              </p>
            )}
            {msg.content && <p className="text-sm">{msg.content}</p>}
            {msg.file_url && (
              <a
                href={msg.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm mt-1 underline"
              >
                <Download className="h-4 w-4" />
                {msg.file_name || 'Datei ansehen'}
              </a>
            )}
          </div>
        </div>
      ))}
      <div ref={scrollRef} />
    </div>
  );
};