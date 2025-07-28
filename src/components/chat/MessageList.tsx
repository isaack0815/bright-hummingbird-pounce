import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types/chat';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Download } from 'lucide-react';

type MessageListProps = {
  conversationId: number;
  currentUserId: string | null;
};

const fetchMessages = async (conversationId: number): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, profiles(id, first_name, last_name)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data as ChatMessage[];
};

export const MessageList = ({ conversationId, currentUserId }: MessageListProps) => {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chatMessages', conversationId],
    queryFn: () => fetchMessages(conversationId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['chatMessages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '??';
  };

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
      {messages?.map((msg) => (
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