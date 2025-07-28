import { useState, useRef, useEffect } from 'react';
import { MessageCircle, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import type { ChatMessage } from '@/types/chat';
import { supabase } from '@/lib/supabase';

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const handleNewMessage = (message: ChatMessage) => {
    if (!isOpen && message.user_id !== currentUserId) {
      setHasNewMessages(true);
      audioRef.current?.play().catch(e => console.error("Audio konnte nicht abgespielt werden:", e));
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessages(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 right-4 z-50">
        <div className="bg-card border rounded-t-lg shadow-lg w-80 md:w-96">
          <button
            className="w-full p-3 flex justify-between items-center cursor-pointer"
            onClick={toggleOpen}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <h3 className="font-semibold">Chat</h3>
              {hasNewMessages && <span className="h-2 w-2 rounded-full bg-destructive" />}
            </div>
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 transform -rotate-180" />}
          </button>
          {isOpen && (
            <div className="flex flex-col h-[24rem]">
              <MessageList onNewMessage={handleNewMessage} />
              <MessageInput />
            </div>
          )}
        </div>
      </div>
      <audio ref={audioRef} src="https://assets.dyad.sh/notification.mp3" preload="auto" />
    </>
  );
};