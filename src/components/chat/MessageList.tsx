import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, Profile } from '@/types/chat';
import { Placeholder, Image } from 'react-bootstrap';
import { Download, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

type MessageListProps = {
  conversationId: number;
  currentUserId: string | null;
};

const fetchMessages = async (conversationId: number): Promise<ChatMessage[]> => {
  const { data: messages, error: messagesError } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (messagesError) throw new Error(messagesError.message);
  if (!messages) return [];

  const userIds = [...new Set(messages.map((msg) => msg.user_id))];
  
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', userIds);

  if (profilesError) throw new Error(profilesError.message);

  const profilesMap = new Map(profiles.map((p) => [p.id, p as Profile]));

  const messagesWithProfiles = messages.map((msg) => ({
    ...msg,
    profiles: profilesMap.get(msg.user_id) || null,
  }));

  return messagesWithProfiles as ChatMessage[];
};

const DownloadableFile = ({ filePath, fileName, fileType }: { filePath: string; fileName: string | null; fileType: string | null }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(filePath, 300);

      if (error) throw error;

      const isPreviewable = fileType?.startsWith('image/') || fileType === 'application/pdf';

      if (isPreviewable) {
        window.open(data.signedUrl, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.setAttribute('download', fileName || 'download');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

    } catch (error) {
      console.error('Error creating signed URL:', error);
      showError("Fehler beim Erstellen des Download-Links.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <a
      href="#"
      onClick={handleDownload}
      className="d-flex align-items-center gap-2 small mt-1 text-decoration-underline"
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      {isLoading ? 'Wird geladen...' : fileName || 'Datei ansehen'}
    </a>
  );
};

export const MessageList = ({ conversationId, currentUserId }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['chatMessages', conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (messages && messages.length > 0) {
        setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100)
    }
  }, [messages]);

  return (
    <div className="flex-grow-1 p-4 d-flex flex-column gap-3" style={{ overflowY: 'auto' }}>
      {isLoading && Array.from({ length: 5 }).map((_, i) => <Placeholder key={i} animation="glow"><Placeholder xs={8} /></Placeholder>)}
      {messages?.map((msg) => (
        <div
          key={msg.id}
          className={`d-flex align-items-end gap-2 ${msg.user_id === currentUserId ? 'justify-content-end' : 'justify-content-start'}`}
        >
          {msg.user_id !== currentUserId && (
            <Image src={`https://api.dicebear.com/8.x/initials/svg?seed=${msg.profiles?.first_name} ${msg.profiles?.last_name}`} roundedCircle style={{ width: 32, height: 32 }} />
          )}
          <div
            className={`mw-75 rounded p-2 ${
              msg.user_id === currentUserId ? 'bg-primary text-white' : 'bg-light'
            }`}
          >
            {msg.user_id !== currentUserId && (
              <p className="small fw-semibold mb-1">
                {msg.profiles?.first_name || 'Benutzer'}
              </p>
            )}
            {msg.content && <p className="small mb-0">{msg.content}</p>}
            {msg.file_url && (
              <DownloadableFile filePath={msg.file_url} fileName={msg.file_name} fileType={msg.file_type} />
            )}
          </div>
        </div>
      ))}
      <div ref={scrollRef} />
    </div>
  );
};