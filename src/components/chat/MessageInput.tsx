import { useState, useRef } from 'react';
import { Form, Button, Popover, OverlayTrigger } from 'react-bootstrap';
import { Paperclip, Send, Smile } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { showError } from '@/utils/toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

type MessageInputProps = {
  conversationId: number;
};

export const MessageInput = ({ conversationId }: MessageInputProps) => {
  const [content, setContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleSendMessage = async (file?: { path: string; name: string; type: string }) => {
    if (!content.trim() && !file) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messageToInsert = {
      user_id: user.id,
      conversation_id: conversationId,
      content: content.trim() || null,
      file_url: file?.path || null,
      file_name: file?.name || null,
      file_type: file?.type || null,
    };

    const { error } = await supabase.from('chat_messages').insert(messageToInsert);

    if (error) {
      showError('Fehler beim Senden der Nachricht.');
      console.error(error);
    } else {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['chatMessages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${Date.now()}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat-files').upload(filePath, file);

      if (uploadError) throw uploadError;
      
      await handleSendMessage({ path: filePath, name: file.name, type: file.type });

    } catch (error) {
      showError('Fehler beim Hochladen der Datei.');
      console.error(error);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prevContent => prevContent + emojiData.emoji);
  };

  const emojiPopover = (
    <Popover id="popover-emoji">
      <Popover.Body style={{ padding: 0 }}>
        <EmojiPicker onEmojiClick={onEmojiClick} />
      </Popover.Body>
    </Popover>
  );

  return (
    <div className="p-2 border-top bg-light">
      <div className="position-relative">
        <Form.Control
          placeholder="Nachricht schreiben..."
          style={{ paddingRight: '6rem' }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <div className="position-absolute top-50 end-0 translate-middle-y d-flex align-items-center">
          <OverlayTrigger trigger="click" placement="top" overlay={emojiPopover} rootClose>
            <Button variant="ghost" size="sm"><Smile size={20} /></Button>
          </OverlayTrigger>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={20} />
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="d-none" />
          <Button variant="ghost" size="sm" onClick={() => handleSendMessage()}>
            <Send size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};