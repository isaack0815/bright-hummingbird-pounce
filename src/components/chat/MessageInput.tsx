import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, Smile } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { showError } from '@/utils/toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const MessageInput = () => {
  const [content, setContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleSendMessage = async (file?: { url: string; name: string; type: string }) => {
    if (!content.trim() && !file) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messageToInsert = {
      user_id: user.id,
      content: content.trim() || null,
      file_url: file?.url || null,
      file_name: file?.name || null,
      file_type: file?.type || null,
    };

    const { error } = await supabase.from('chat_messages').insert(messageToInsert);

    if (error) {
      showError('Fehler beim Senden der Nachricht.');
      console.error(error);
    } else {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['chatMessages'] });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat_files').upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_files').getPublicUrl(fileName);
      
      await handleSendMessage({ url: publicUrl, name: file.name, type: file.type });

    } catch (error) {
      showError('Fehler beim Hochladen der Datei.');
      console.error(error);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prevContent => prevContent + emojiData.emoji);
  };

  return (
    <div className="p-2 border-t bg-background">
      <div className="relative">
        <Input
          placeholder="Nachricht schreiben..."
          className="pr-28"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon"><Smile className="h-5 w-5" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0" side="top" align="end">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-5 w-5" />
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <Button variant="ghost" size="icon" onClick={() => handleSendMessage()}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};