import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useObjectStorage } from "@/hooks/use-object-storage";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  files: File[];
  maxFiles?: number;
  acceptedTypes?: string[];
  maxFileSize?: number; // in bytes
  className?: string;
}

export function FileUpload({
  onFilesChange,
  files,
  maxFiles = 5,
  acceptedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  className,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string>("");

  const validateFile = (file: File): boolean => {
    if (!acceptedTypes.includes(file.type)) {
      setError(`Tipo de arquivo não suportado: ${file.type}. Use PDF, DOC, DOCX ou TXT.`);
      return false;
    }

    if (file.size > maxFileSize) {
      setError(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo: ${maxFileSize / 1024 / 1024}MB.`);
      return false;
    }

    if (files.length >= maxFiles) {
      setError(`Máximo de ${maxFiles} arquivos permitido.`);
      return false;
    }

    setError("");
    return true;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles: File[] = [];

    for (const file of droppedFiles) {
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        break; // Stop processing on first error
      }
    }

    if (validFiles.length > 0) {
      const newFiles = [...files, ...validFiles].slice(0, maxFiles);
      onFilesChange(newFiles);
    }
  }, [files, onFilesChange, maxFiles, validateFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles: File[] = [];

    for (const file of selectedFiles) {
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        break;
      }
    }

    if (validFiles.length > 0) {
      const newFiles = [...files, ...validFiles].slice(0, maxFiles);
      onFilesChange(newFiles);
    }

    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    setError("");
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('text')) return '📄';
    return '📄';
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-primary/40"
        )}
      >
        <div className="mb-4">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Arraste seus arquivos aqui
          </p>
          <p className="text-gray-500 mb-4">ou clique para selecionar</p>
        </div>
        
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={files.length >= maxFiles}
        />
        
        <label htmlFor="file-upload">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={files.length >= maxFiles}
            asChild
          >
            <span>
              <File className="w-4 h-4 mr-2" />
              Selecionar Arquivos
            </span>
          </Button>
        </label>
        
        <p className="text-sm text-gray-500 mt-4">
          Suporta PDF, DOC, DOCX, TXT (máx. {maxFileSize / 1024 / 1024}MB cada)
        </p>
        <p className="text-xs text-gray-400">
          {files.length}/{maxFiles} arquivos selecionados
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Arquivos selecionados:</h4>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getFileIcon(file.type)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
