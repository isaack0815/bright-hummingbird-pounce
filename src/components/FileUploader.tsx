import { useState, useCallback } from 'react';
import { Upload, X, File as FileIcon } from 'lucide-react';
import { Button } from 'react-bootstrap';

type FileUploaderProps = {
  onFileSelect: (file: File | null) => void;
};

export const FileUploader = ({ onFileSelect }: FileUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    onFileSelect(selectedFile);
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFileChange(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  }, [onFileSelect]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFileChange(event.target.files[0]);
    }
    event.target.value = '';
  };

  const onRemoveFile = () => {
    handleFileChange(null);
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isDragOver ? 'border-primary bg-primary-subtle' : 'border-secondary-subtle bg-light'
      }`}
      style={{ cursor: 'pointer' }}
      onClick={() => document.getElementById('file-input-uploader')?.click()}
    >
      <input
        type="file"
        id="file-input-uploader"
        className="d-none"
        onChange={onFileInputChange}
        accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
      />
      {file ? (
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2 text-start overflow-hidden">
            <FileIcon size={24} className="text-muted flex-shrink-0" />
            <span className="fw-medium text-truncate">{file.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemoveFile(); }}>
            <X size={16} />
          </Button>
        </div>
      ) : (
        <div className="d-flex flex-column align-items-center gap-2 text-muted">
          <Upload size={32} />
          <span>Datei hierher ziehen oder klicken</span>
          <small>.xlsx, .xls</small>
        </div>
      )}
    </div>
  );
};