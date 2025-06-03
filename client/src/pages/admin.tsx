
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuthContext } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  Users, 
  BookOpen, 
  Brain, 
  MessageSquare, 
  Eye,
  Calendar,
  TrendingUp,
  Download
} from "lucide-react";
import { exportDataAsJSON, exportPromptAsText, formatPromptForDisplay } from "@/lib/adminUtils";

export default function AdminPage() {
  const { user } = useAuthContext();
  const [, setLocation] = useLocation();
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Redirect if not admin
  if (user?.role !== 'admin') {
    setLocation('/dashboard');
    return null;
  }

  const { data: stats } = useQuery({
    queryKey: ['/api/admin/stats'],
  });

  const { data: aiLogs } = useQuery({
    queryKey: ['/api/admin/ai-logs'],
  });

  const { data: users } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR');
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="text-gray-600 mt-2">Gerencie o sistema e monitore atividades</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setLocation('/dashboard')}
          >
            Voltar ao Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sermões Gerados</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSermons || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Perfis DNA</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalDnaProfiles || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chamadas IA</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalAiLogs || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="ai-logs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-logs">Logs da IA</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Logs das Chamadas da IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {aiLogs?.map((log: any) => (
                      <div key={log.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={log.type === 'sermon' ? 'default' : 'secondary'}>
                                {log.type === 'sermon' ? 'Sermão' : 'DNA'}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {log.user?.name} ({log.user?.email})
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedLog(log)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalhes
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => exportPromptAsText(
                                    formatPromptForDisplay(log.prompt), 
                                    `prompt-${log.type}-${log.id}-${log.user?.email}`
                                  )}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Exportar
                                </Button>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  Log da IA - {log.type === 'sermon' ? 'Sermão' : 'DNA'}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold mb-2">Usuário:</h4>
                                  <p>{log.user?.name} ({log.user?.email})</p>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Data:</h4>
                                  <p>{formatDate(log.createdAt)}</p>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Prompt Enviado:</h4>
                                  <div className="bg-gray-100 p-4 rounded-lg max-h-60 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm">{log.prompt}</pre>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Resposta da IA:</h4>
                                  <div className="bg-gray-100 p-4 rounded-lg max-h-60 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm">{log.response}</pre>
                                  </div>
                                </div>
                                {log.metadata && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Metadados:</h4>
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                      <pre className="text-sm">{JSON.stringify(log.metadata, null, 2)}</pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium">Prompt:</span>
                            <p className="text-sm text-gray-700 mt-1">
                              {truncateText(log.prompt, 200)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {users?.map((user: any) => (
                      <div key={user.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{user.name}</h3>
                              <Badge variant={user.role === 'admin' ? 'destructive' : 'default'}>
                                {user.role === 'admin' ? 'Admin' : 'Usuário'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{user.email}</p>
                            <p className="text-sm text-gray-500">
                              Cadastrado em: {formatDate(user.createdAt)}
                            </p>
                            {user.activeDnaProfileId && (
                              <p className="text-sm text-green-600">
                                DNA Ativo: ID #{user.activeDnaProfileId}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Informações do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Versão do Sistema</h4>
                    <p className="text-sm text-gray-600">v1.0.0</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Modelo de IA</h4>
                    <p className="text-sm text-gray-600">Google Gemini 1.5</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Banco de Dados</h4>
                    <p className="text-sm text-gray-600">PostgreSQL (Neon)</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Última Atualização</h4>
                    <p className="text-sm text-gray-600">{new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
