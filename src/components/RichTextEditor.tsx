import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  return (
    <div className="rounded-md border border-input">
      <Editor
        apiKey="no-api-key"
        value={value}
        onEditorChange={(newValue) => onChange(newValue)}
        init={{
          height: 200,
          menubar: false,
          plugins: [
            'lists', 'link', 'autolink', 'wordcount'
          ],
          toolbar: 'undo redo | blocks | bold italic | bullist numlist | link',
          content_style: 'body { font-family:inherit; font-size:14px }',
          skin: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'oxide-dark' : 'oxide',
          content_css: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'default'
        }}
      />
    </div>
  );
}