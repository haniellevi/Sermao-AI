import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { 
  FileText, 
  Search, 
  Download, 
  Edit, 
  Calendar, 
  Filter,
  MoreVertical,
  Eye,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { exportToPDF, exportToDOCX } from '@/lib/exportUtils';

export default function HistoryPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const { data: sermonsData, isLoading } = useQuery({
    queryKey: ['/api/sermons'],
    enabled: !!user,
  });

  const filteredSermons = Array.isArray(sermonsData) 
    ? sermonsData.filter((sermon: any) =>
        sermon.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleExportPDF = async (sermon: any) => {
    try {
      await exportToPDF(sermon);
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

  const handleExportDOCX = async (sermon: any) => {
    try {
      await exportToDOCX(sermon);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Histórico de Sermões</h1>
            <p className="text-gray-600">Gerencie todos os seus sermões criados</p>
          </div>

          {/* Search and Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar sermões..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" className="flex items-center">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-primary/10 rounded-full p-3 mr-4">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {Array.isArray(sermonsData) ? sermonsData.length : 0}
                    </p>
                    <p className="text-gray-600">Total de Sermões</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-emerald-100 rounded-full p-3 mr-4">
                    <Calendar className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {Array.isArray(sermonsData) ? Math.min(sermonsData.length, 30) : 0}
                    </p>
                    <p className="text-gray-600">Últimos 30 dias</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="bg-amber-100 rounded-full p-3 mr-4">
                    <Download className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">0</p>
                    <p className="text-gray-600">Downloads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sermons List */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Carregando sermões...</p>
            </div>
          ) : filteredSermons.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm ? 'Nenhum sermão encontrado' : 'Nenhum sermão criado ainda'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm 
                    ? 'Tente buscar com outros termos.' 
                    : 'Comece criando seu primeiro sermão personalizado.'
                  }
                </p>
                {!searchTerm && (
                  <Link href="/generate-sermon">
                    <Button className="bg-primary hover:bg-primary/90">
                      Criar Primeiro Sermão
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredSermons.map((sermon: any) => (
                <Card key={sermon.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {sermon.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            ID: {sermon.id}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-500 mb-3">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(sermon.createdAt)}
                        </div>

                        <div className="text-sm text-gray-600 line-clamp-2">
                          {(() => {
                            try {
                              const content = JSON.parse(sermon.content);
                              const preview = typeof content.sermao === 'string' 
                                ? content.sermao.substring(0, 200) + '...'
                                : 'Conteúdo do sermão disponível';
                              return preview;
                            } catch {
                              return sermon.content?.substring(0, 200) + '...' || 'Conteúdo não disponível';
                            }
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/sermon-result/${sermon.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </Button>
                        </Link>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link href={`/edit-sermon/${sermon.id}`} className="flex items-center w-full">
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExportPDF(sermon)}>
                              <Download className="w-4 h-4 mr-2" />
                              Baixar como PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportDOCX(sermon)}>
                              <Download className="w-4 h-4 mr-2" />
                              Baixar como DOCX
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}