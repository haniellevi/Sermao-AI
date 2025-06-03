import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiUpload } from "@/lib/api";

// Função auxiliar para debug de token
const getTokenForRequest = (): string | null => {
  // Tentar diferentes chaves de localStorage
  const possibleKeys = ['token', 'auth_token', 'authToken'];

  for (const key of possibleKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      console.log(`[TokenDebug] Found token in localStorage key: ${key}`);
      return token;
    }
  }

  console.log(`[TokenDebug] No token found in any localStorage key`);
  return null;
};

interface UploadResult {
  success: boolean;
  fileName: string;
  message: string;
}

export default function AdminBulkIndexPage() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  const [timeElapsed, setTimeElapsed] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0);
  const [currentFile, setCurrentFile] = useState('');

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground">Você precisa estar logado para acessar esta área.</p>
        <Button onClick={() => setLocation('/login')} className="mt-4">
          Fazer Login
        </Button>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground">Apenas administradores podem acessar esta área.</p>
        <Button onClick={() => setLocation('/')} className="mt-4">
          Voltar ao Início
        </Button>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(files);
      setResults([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      setResults([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um arquivo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setResults([]);
    setTimeElapsed(0);
    setEstimatedTimeLeft(0);
    setCurrentFile('');

    const startTime = Date.now();
    const totalFiles = selectedFiles.length;

    // Timer para mostrar tempo decorrido
    const timeInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeElapsed(elapsed);

      // Estimar tempo restante baseado no progresso
      if (progress > 10) {
        const rate = progress / elapsed;
        const remaining = Math.floor((100 - progress) / rate);
        setEstimatedTimeLeft(remaining);
      }
    }, 1000);

    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach((file, index) => {
        formData.append('documents', file);
        if (index === 0) setCurrentFile(file.name);
      });

      // Progresso mais realista baseado no número de arquivos
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + (80 / totalFiles) * Math.random();
        });
      }, 2000);

      const response = await apiUpload("/api/admin/rag/bulk-index", formData);

      clearInterval(progressInterval);
      clearInterval(timeInterval);
      setProgress(100);
      setCurrentFile('Concluído');
      setResults(response.results || []);

      const successCount = response.successful || 0;
      const totalCount = response.processed || 0;

      toast({
        title: "Processamento Concluído",
        description: `${successCount}/${totalCount} arquivos indexados com sucesso`,
        variant: successCount === totalCount ? "default" : "destructive",
      });

      setSelectedFiles(null);
      const fileInput = document.getElementById('document-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      clearInterval(timeInterval);
      toast({
        title: "Erro no Upload",
        description: error.message || "Falha no processamento",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
      setTimeElapsed(0);
      setEstimatedTimeLeft(0);
      setCurrentFile('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Painel Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Indexação em Lote RAG</h1>
          <p className="text-muted-foreground">
            Faça upload de múltiplos documentos para indexação automática na base de conhecimento
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Upload de Documentos
              </CardTitle>
              <CardDescription>
                Arraste arquivos aqui ou selecione arquivos .txt, .pdf, .docx ou .md para indexação. Máximo 20 arquivos por vez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragOver 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById('documents')?.click()}
              >
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg font-medium">
                      {isDragOver ? 'Solte os arquivos aqui' : 'Arraste arquivos aqui'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ou clique no botão abaixo para selecionar
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="documents">Documentos</Label>
                <Input
                  id="documents"
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx,.md"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="mt-1"
                />
              </div>

              {selectedFiles && selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Arquivos selecionados ({selectedFiles.length}):</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {Array.from(selectedFiles).map((file, index) => (
                      <div key={index} className="flex items-center text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 mr-2" />
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{currentFile ? `Processando: ${currentFile}` : 'Processando documentos para indexação...'}</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tempo decorrido: {timeElapsed}s</span>
                    <span>
                      {estimatedTimeLeft > 0
                        ? `Tempo restante estimado: ${estimatedTimeLeft}s`
                        : 'Calculando tempo restante...'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Por favor, aguarde enquanto os documentos são processados e indexados na base RAG
                  </p>
                </div>
              )}

              <Button 
                onClick={handleUpload} 
                disabled={uploading || !selectedFiles || selectedFiles.length === 0}
                className="w-full"
              >
                {uploading ? 'Processando...' : 'Iniciar Upload e Indexação'}
              </Button>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resultados do Processamento</CardTitle>
                <CardDescription>
                  Status de cada arquivo processado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div key={index} className="flex items-center justify-between border rounded p-3">
                      <div className="flex items-center">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className="font-medium">{result.fileName}</span>
                      </div>
                      <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                        {result.message}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}