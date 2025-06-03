import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Users, 
  FileText, 
  Database, 
  Activity, 
  TrendingUp, 
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  BookOpen,
  Settings,
  Trash2,
  Eye,
  UserX,
  UserCheck
} from "lucide-react";
import { Link } from "wouter";

interface AdminStats {
  users: {
    total: number;
    active: number;
  };
  sermons: {
    total: number;
    recent: any[];
  };
  dna: {
    custom: number;
    total: number;
  };
  rag: {
    documentCount: number;
    chunkCount: number;
  };
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface RagDocument {
  documentId: string;
  sourceUrl: string;
  userId: number;
  chunkCount: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta área",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Admin dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/dashboard"],
    enabled: !!user && user.role === 'admin'
  });

  // Users management
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user && user.role === 'admin' && activeTab === 'users'
  });

  // RAG documents management
  const { data: ragDocs, isLoading: ragLoading, refetch: refetchRag } = useQuery<RagDocument[]>({
    queryKey: ["/api/admin/rag/documents"],
    enabled: !!user && user.role === 'admin' && activeTab === 'rag'
  });

  const handleUserStatusToggle = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          isActive: !currentStatus
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao alterar status do usuário');
      }
      
      toast({
        title: "Sucesso",
        description: `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`,
      });
      
      refetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || 'Erro ao alterar status do usuário',
        variant: "destructive",
      });
    }
  };

  const handleUserDelete = async (userId: number, userName: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao deletar usuário');
      }
      
      toast({
        title: "Sucesso",
        description: "Usuário deletado com sucesso",
      });
      
      refetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || 'Erro ao deletar usuário',
        variant: "destructive",
      });
    }
  };

  const handleRagDocDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/admin/rag/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao remover documento');
      }
      
      toast({
        title: "Sucesso",
        description: "Documento removido com sucesso",
      });
      
      refetchRag();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || 'Erro ao remover documento',
        variant: "destructive",
      });
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-6 text-center">
        <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground">Apenas administradores podem acessar esta área.</p>
        <Link href="/dashboard">
          <Button className="mt-4">Voltar ao Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground">
          Gerenciamento completo do sistema de geração de sermões
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="rag">Base RAG</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-8 bg-muted rounded w-1/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total de Usuários</p>
                        <p className="text-2xl font-bold">{stats?.users.total || 0}</p>
                      </div>
                      <Users className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Usuários Ativos (30d)</p>
                        <p className="text-2xl font-bold">{stats?.users.active || 0}</p>
                      </div>
                      <Activity className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Sermões Gerados</p>
                        <p className="text-2xl font-bold">{stats?.sermons.total || 0}</p>
                      </div>
                      <FileText className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Documentos RAG</p>
                        <p className="text-2xl font-bold">{stats?.rag.documentCount || 0}</p>
                      </div>
                      <Database className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Sermons */}
              <Card>
                <CardHeader>
                  <CardTitle>Sermões Recentes</CardTitle>
                  <CardDescription>Últimos sermões gerados no sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.sermons.recent?.slice(0, 5).map((sermon: any) => (
                      <div key={sermon.id} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <p className="font-medium">{sermon.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Usuário ID: {sermon.userId} • {new Date(sermon.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {sermon.theme}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* DNA Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Uso de DNA</CardTitle>
                    <CardDescription>Distribuição de tipos de DNA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>DNA Customizado:</span>
                        <span className="font-medium">{stats?.dna.custom || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total de Perfis:</span>
                        <span className="font-medium">{stats?.dna.total || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxa de Customização:</span>
                        <span className="font-medium">
                          {stats?.dna.total ? Math.round((stats.dna.custom / stats.dna.total) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Base de Conhecimento</CardTitle>
                    <CardDescription>Estatísticas do sistema RAG</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Documentos:</span>
                        <span className="font-medium">{stats?.rag.documentCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fragmentos:</span>
                        <span className="font-medium">{stats?.rag.chunkCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Média por Doc:</span>
                        <span className="font-medium">
                          {stats?.rag.documentCount ? Math.round(stats.rag.chunkCount / stats.rag.documentCount) : 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>Lista de todos os usuários do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse border rounded p-4">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center justify-between border rounded p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                          <Badge variant={user.isActive ? 'default' : 'destructive'}>
                            {user.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Criado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUserStatusToggle(user.id, user.isActive)}
                        >
                          {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          {user.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Por enquanto, mostrar informações básicas em um alert
                            // Posteriormente pode ser criada uma página de detalhes
                            alert(`Detalhes do usuário:\nID: ${user.id}\nNome: ${user.name}\nEmail: ${user.email}\nRole: ${user.role}\nStatus: ${user.isActive ? 'Ativo' : 'Inativo'}\nCriado em: ${new Date(user.createdAt).toLocaleDateString('pt-BR')}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          Detalhes
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUserDelete(user.id, user.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Deletar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RAG Management Tab */}
        <TabsContent value="rag" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento da Base RAG</CardTitle>
              <CardDescription>Documentos indexados no sistema de recuperação</CardDescription>
            </CardHeader>
            <CardContent>
              {ragLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse border rounded p-4">
                      <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/3"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {ragDocs?.map((doc) => (
                    <div key={doc.documentId} className="flex items-center justify-between border rounded p-4">
                      <div className="flex-1">
                        <p className="font-medium">{doc.documentId}</p>
                        <p className="text-sm text-muted-foreground">{doc.sourceUrl}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>Usuário: {doc.userId}</span>
                          <span>Fragmentos: {doc.chunkCount}</span>
                          <span>Criado: {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover o documento "{doc.documentId}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRagDocDelete(doc.documentId)}>
                              Confirmar Exclusão
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>Configurações avançadas e manutenção</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border rounded p-4">
                  <div>
                    <p className="font-medium">Indexação em Lote RAG</p>
                    <p className="text-sm text-muted-foreground">
                      Faça upload de múltiplos documentos para indexação
                    </p>
                  </div>
                  <Link href="/admin/bulk-index">
                    <Button>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Acessar
                    </Button>
                  </Link>
                </div>
                
                <div className="flex items-center justify-between border rounded p-4">
                  <div>
                    <p className="font-medium">Relatórios Avançados</p>
                    <p className="text-sm text-muted-foreground">
                      Gerar relatórios detalhados do sistema
                    </p>
                  </div>
                  <Button disabled>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Em Breve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}