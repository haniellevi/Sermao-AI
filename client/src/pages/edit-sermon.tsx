import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Navbar } from '@/components/layout/navbar';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function EditSermonPage() {
  const [location, navigate] = useLocation();
  const params = useParams();
  const sermonId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isModified, setIsModified] = useState(false);

  const { data: sermonResponse, isLoading, error } = useQuery({
    queryKey: ['/api/sermons', sermonId],
    enabled: !!sermonId,
  });

  // Handle the case where API returns array instead of single object
  const sermonData = Array.isArray(sermonResponse) ? sermonResponse[0] : sermonResponse;

  useEffect(() => {
    if (sermonData) {
      console.log('Sermon data received:', sermonData);
      setTitle(sermonData.title || '');
      
      try {
        const parsedContent = JSON.parse(sermonData.content);
        console.log('Parsed content:', parsedContent);
        if (typeof parsedContent.sermao === 'string') {
          setContent(parsedContent.sermao);
        } else {
          setContent(sermonData.content);
        }
      } catch (error) {
        console.log('Parse error:', error);
        setContent(sermonData.content || '');
      }
    }
  }, [sermonData]);

  const updateMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await fetch(`/api/sermons/${sermonId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Falha ao atualizar sermão');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sermão atualizado!",
        description: "As alterações foram salvas com sucesso.",
      });
      setIsModified(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/sermons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sermons', sermonId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Por favor, insira um título para o sermão.",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Conteúdo obrigatório",
        description: "Por favor, insira o conteúdo do sermão.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ title: title.trim(), content: content.trim() });
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setIsModified(true);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsModified(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-gray-600">Carregando sermão...</p>
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
            <p className="text-gray-600 mb-8">O sermão que você está tentando editar não foi encontrado.</p>
            <Button onClick={() => navigate('/history')} className="bg-primary hover:bg-primary/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Histórico
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/history')}
                  className="mr-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    <FileText className="w-8 h-8 mr-3" />
                    Editar Sermão
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Faça as alterações necessárias no seu sermão
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {isModified && (
                  <span className="text-sm text-amber-600 font-medium">
                    Alterações não salvas
                  </span>
                )}
                <Button 
                  onClick={handleSave}
                  disabled={!isModified || updateMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-6">
            {/* Title */}
            <Card>
              <CardHeader>
                <CardTitle>Título do Sermão</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Digite o título do sermão..."
                  className="text-lg"
                />
              </CardContent>
            </Card>

            {/* Content */}
            <Card>
              <CardHeader>
                <CardTitle>Conteúdo do Sermão</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Digite o conteúdo do sermão..."
                  className="min-h-[500px] text-base leading-relaxed"
                />
                <div className="mt-2 text-sm text-gray-500">
                  {content.length} caracteres
                </div>
              </CardContent>
            </Card>

            {/* Save Button (Mobile) */}
            <div className="md:hidden">
              <Button 
                onClick={handleSave}
                disabled={!isModified || updateMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}