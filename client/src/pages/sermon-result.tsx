import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/navbar';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FileText, Copy, Star, Lightbulb, ArrowLeft, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { exportToPDF, exportToDOCX } from '@/lib/exportUtils';

export default function SermonResultPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  const sermonId = params.id;

  const { data: sermonResponse, isLoading, error } = useQuery({
    queryKey: ['/api/sermons', sermonId],
    enabled: !!sermonId,
  });

  // Handle the case where API returns array instead of single object
  const sermonData = Array.isArray(sermonResponse) ? sermonResponse[0] : sermonResponse;

  const copyToClipboard = async () => {
    if (!sermonData) return;

    let sermon;
    try {
      sermon = JSON.parse(sermonData.content);
    } catch (error) {
      sermon = { sermao: sermonData.content };
    }
    
    let textContent = '';

    // Check for new format (complete sermon text)
    if (typeof sermon.sermao === 'string') {
      textContent = sermon.sermao;
    } else {
      // Fallback to old format
      textContent = `${sermon.titulo || 'Sermão'}\n\n`;
      if (sermon.texto_base) textContent += `Texto Base: ${sermon.texto_base}\n\n`;
      if (sermon.introducao) textContent += `${sermon.introducao}\n\n`;
      
      if (sermon.pontos) {
        sermon.pontos.forEach((ponto: any, index: number) => {
          textContent += `${index + 1}. ${ponto.titulo}\n${ponto.conteudo}\n\n`;
        });
      }
      
      if (sermon.conclusao) textContent += `Conclusão:\n${sermon.conclusao}\n\n`;
      if (sermon.oracao_final) textContent += `Oração Final:\n${sermon.oracao_final}\n\n`;
    }

    try {
      await navigator.clipboard.writeText(textContent);
      toast({
        title: "Sermão copiado!",
        description: "O sermão foi copiado para a área de transferência.",
      });
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o sermão.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    if (!sermonData) return;
    try {
      await exportToPDF(sermonData);
      toast({
        title: "PDF gerado!",
        description: "O sermão foi exportado em PDF com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível exportar o sermão em PDF.",
        variant: "destructive",
      });
    }
  };

  const handleExportDOCX = async () => {
    if (!sermonData) return;
    try {
      await exportToDOCX(sermonData);
      toast({
        title: "DOCX gerado!",
        description: "O sermão foi exportado em DOCX com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar DOCX",
        description: "Não foi possível exportar o sermão em DOCX.",
        variant: "destructive",
      });
    }
  };

  const deleteSermonMutation = useMutation({
    mutationFn: async (sermonId: string) => {
      // Espera um momento para garantir que o token foi atualizado após login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const token = localStorage.getItem('token');
      console.log('Token being used for deletion:', {
        exists: !!token,
        length: token?.length || 0,
        preview: token ? token.substring(0, 20) + '...' : 'No token'
      });
      
      if (!token) {
        throw new Error('Token de acesso necessário');
      }
      
      const response = await fetch(`/api/sermons/${sermonId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('Delete error response:', errorData);
        throw new Error(errorData.message || 'Falha ao excluir sermão');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sermão excluído!",
        description: "O sermão foi excluído com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sermons'] });
      navigate('/dashboard');
    },
    onError: (error: any) => {
      console.error("Erro ao excluir sermão:", error);
      if (error.message.includes('Token inválido') || error.message.includes('Token de acesso')) {
        toast({
          title: "Sessão expirada",
          description: "Sua sessão expirou. Redirecionando para login...",
          variant: "destructive",
        });
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 2000);
      } else {
        toast({
          title: "Erro ao excluir",
          description: error.message || "Não foi possível excluir o sermão.",
          variant: "destructive",
        });
      }
    },
  });

  const handleDeleteSermon = () => {
    console.log('Delete button clicked, sermonId:', sermonId);
    if (sermonId) {
      console.log('Starting deletion mutation...');
      deleteSermonMutation.mutate(sermonId);
    } else {
      console.log('No sermonId available for deletion');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 rounded w-1/3"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              <div className="h-64 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sermonData) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Sermão não encontrado</h1>
            <p className="text-gray-600 mb-8">O sermão que você está procurando não foi encontrado.</p>
            <Button onClick={() => navigate('/dashboard')} className="bg-primary hover:bg-primary/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Parse the sermon content (it's stored as JSON string)
  let sermonContent;
  try {
    sermonContent = JSON.parse(sermonData.content);
  } catch (error) {
    console.error('Error parsing sermon content:', error);
    sermonContent = {
      sermao: sermonData.content,
      sugestoes_enriquecimento: [],
      avaliacao_qualidade: "Não disponível"
    };
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>

          {/* Sermon Content */}
          <Card className="shadow-lg mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold flex items-center">
                  <FileText className="w-6 h-6 mr-2" />
                  {sermonData.title}
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={copyToClipboard} variant="outline">
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  <Button onClick={handleExportPDF} className="bg-primary hover:bg-primary/90">
                    Baixar PDF
                  </Button>
                  <Button onClick={handleExportDOCX} variant="outline">
                    Baixar DOCX
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        className="hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza de que deseja excluir este sermão? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteSermon}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deleteSermonMutation.isPending}
                        >
                          {deleteSermonMutation.isPending ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="sermon-content space-y-6">
                {/* New format - complete sermon text */}
                {typeof sermonContent.sermao === 'string' ? (
                  <div className="prose prose-lg max-w-none">
                    <div 
                      className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: sermonContent.sermao.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                    />
                  </div>
                ) : (
                  /* Fallback to old format */
                  <>
                    {sermonContent.introducao && (
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">Introdução</h2>
                        <p className="text-gray-700 leading-relaxed">{sermonContent.introducao}</p>
                      </div>
                    )}

                    {sermonContent.pontos && sermonContent.pontos.map((ponto: any, index: number) => (
                      <div key={index}>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">{ponto.titulo}</h2>
                        <p className="text-gray-700 leading-relaxed">{ponto.conteudo}</p>
                      </div>
                    ))}

                    {sermonContent.conclusao && (
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">Conclusão</h2>
                        <p className="text-gray-700 leading-relaxed">{sermonContent.conclusao}</p>
                      </div>
                    )}

                    {sermonContent.oracao_final && (
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">Oração Final</h2>
                        <p className="text-gray-700 leading-relaxed">{sermonContent.oracao_final}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhancement Suggestions */}
          {sermonContent.sugestoes_enriquecimento && sermonContent.sugestoes_enriquecimento.length > 0 && (
            <Card className="shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2" />
                  Sugestões de Enriquecimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {sermonContent.sugestoes_enriquecimento.map((sugestao: any, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{String(sugestao)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Quality Assessment */}
          {sermonContent.avaliacao_qualidade && sermonContent.avaliacao_qualidade !== "Não disponível" && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  Avaliação de Qualidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-gray-700 leading-relaxed">
                  {typeof sermonContent.avaliacao_qualidade === 'object' ? (
                    <div>
                      <div className="mb-2">
                        <strong>Nota:</strong> {sermonContent.avaliacao_qualidade.nota}/10
                      </div>
                      <div>
                        <strong>Justificativa:</strong> {sermonContent.avaliacao_qualidade.justificativa}
                      </div>
                    </div>
                  ) : (
                    <p>{String(sermonContent.avaliacao_qualidade)}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}