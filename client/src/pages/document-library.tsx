import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, BookOpen, Database } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RagStats {
  documentCount: number;
  chunkCount: number;
}

export default function DocumentLibrary() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragOver, setIsDragOver] = useState(false);

  // Fetch RAG statistics
  const { data: stats, isLoading: statsLoading } = useQuery<RagStats>({
    queryKey: ["/api/rag/stats"],
  });

  // Upload documents mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('documents', file);
      });

      return apiUpload("/api/rag/upload", formData);
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message,
      });
      setSelectedFiles(null);
      // Reset file input
      const fileInput = document.getElementById('document-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      // Refresh stats
      queryClient.invalidateQueries({ queryKey: ["/api/rag/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no Upload",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Clear documents mutation
  const clearMutation = useMutation({
    mutationFn: () => apiRequest("/api/rag/documents", "DELETE"),
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rag/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um documento",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    uploadMutation.mutate(selectedFiles);
  };

  const handleClearDocuments = () => {
    if (window.confirm("Tem certeza que deseja remover todos os documentos? Esta ação não pode ser desfeita.")) {
      clearMutation.mutate();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };


  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Biblioteca de Documentos Teológicos
        </h1>
        <p className="text-muted-foreground">
          Upload documentos teológicos para enriquecer a geração de sermões com contexto relevante
        </p>
      </div>

      {/* Statistics Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Estatísticas da Biblioteca
          </CardTitle>
          <CardDescription>
            Informações sobre os documentos indexados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center space-x-4">
              <div className="animate-pulse bg-muted h-4 w-20 rounded"></div>
              <div className="animate-pulse bg-muted h-4 w-32 rounded"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats?.documentCount || 0}</div>
                <div className="text-sm text-muted-foreground">Documentos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats?.chunkCount || 0}</div>
                <div className="text-sm text-muted-foreground">Fragmentos Indexados</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Documentos
          </CardTitle>
          <CardDescription>
            Arraste documentos aqui ou selecione arquivos para enriquecer a base de conhecimento dos sermões
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-gray-400" />
              <div>
                <p className="font-medium">
                  {isDragOver ? 'Solte os arquivos aqui' : 'Arraste documentos aqui'}
                </p>
                <p className="text-sm text-muted-foreground">
                  ou clique no botão abaixo para selecionar
                </p>
              </div>
            </div>
          </div>

          <div>
            <Input
              id="document-upload"
              type="file"
              multiple
              accept=".txt,.pdf,.docx"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Aceita arquivos TXT, PDF e DOCX (máximo 10 arquivos)
            </p>
          </div>

          {selectedFiles && selectedFiles.length > 0 && (
            <div>
              <Label>Arquivos Selecionados:</Label>
              <div className="mt-2 space-y-1">
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{file.name}</span>
                    <span className="text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFiles || selectedFiles.length === 0 || isUploading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? "Processando..." : "Fazer Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Alert */}
      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertDescription>
          <strong>Como funciona:</strong> Os documentos são processados e divididos em fragmentos para busca semântica. 
          Durante a geração de sermões, o sistema automaticamente encontra e utiliza trechos relevantes 
          dos seus documentos para enriquecer o conteúdo com insights teológicos mais profundos.
        </AlertDescription>
      </Alert>

      {/* Clear Documents Section */}
      {stats && stats.documentCount > 0 && (
        <Card className="mt-6 border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Limpar Biblioteca
            </CardTitle>
            <CardDescription>
              Remove todos os documentos indexados da biblioteca
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={handleClearDocuments}
              disabled={clearMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {clearMutation.isPending ? "Removendo..." : "Limpar Todos os Documentos"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}