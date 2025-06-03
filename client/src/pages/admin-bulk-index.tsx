import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/lib/auth";
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
  const { user } = useAuthContext();

  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground">Apenas administradores podem acessar esta área.</p>
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
        description: "Selecione pelo menos um arquivo para upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setResults([]);

    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      formData.append('documents', file);
    });

    // Simular progresso durante upload
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        clearInterval(progressInterval);
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/admin/rag/bulk-index', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro no upload');
      }

      const data = await response.json();
      setResults(data.results || []);
      setProgress(100);

      toast({
        title: "Upload Concluído",
        description: `${data.results?.filter((r: UploadResult) => r.success).length || 0} arquivos processados com sucesso`,
      });

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || 'Erro durante o upload',
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
                    <span>Processando documentos para indexação...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
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