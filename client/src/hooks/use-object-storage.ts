
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

interface UploadFileResult {
  files: Array<{
    name: string;
    size: number;
    type: string;
    key: string;
  }>;
}

export function useObjectStorage() {
  // Upload de arquivos
  const uploadFiles = useMutation({
    mutationFn: async (files: FileList | File[]): Promise<UploadFileResult> => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/dna-profiles/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erro ao fazer upload dos arquivos');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/dna-profiles'] });
    },
  });

  // Download de arquivo
  const downloadFile = async (key: string, fileName?: string) => {
    try {
      const response = await fetch(`/api/files/${key}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erro ao baixar arquivo');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Criar link para download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || key.split('/').pop() || 'arquivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpar URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro no download:', error);
      throw error;
    }
  };

  return {
    uploadFiles,
    downloadFile,
    isUploading: uploadFiles.isPending,
    uploadError: uploadFiles.error,
  };
}
