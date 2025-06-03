import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthContext } from "@/lib/auth";
import { 
  ArrowLeft, 
  BarChart3, 
  Users, 
  FileText, 
  Database, 
  Download,
  Calendar,
  Activity
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface SystemReport {
  users: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    newThisMonth: number;
  };
  sermons: {
    total: number;
    thisMonth: number;
    avgPerUser: number;
    topThemes: Array<{ theme: string; count: number }>;
  };
  dna: {
    totalProfiles: number;
    customProfiles: number;
    defaultProfiles: number;
    avgProfilesPerUser: number;
  };
  rag: {
    totalDocuments: number;
    totalChunks: number;
    avgChunksPerDoc: number;
    documentsByUser: Array<{ userId: number; userName: string; documentCount: number }>;
  };
  usage: {
    peakHours: Array<{ hour: number; requests: number }>;
    topUsers: Array<{ userId: number; userName: string; sermonCount: number }>;
  };
}

export default function AdminReportsPage() {
  const { user } = useAuthContext();
  const [, setLocation] = useLocation();
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'year'>('month');

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['/api/admin/reports', reportPeriod],
    retry: false,
  });

  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground">Apenas administradores podem acessar esta área.</p>
      </div>
    );
  }

  const exportReport = (format: 'csv' | 'json') => {
    if (!report) return;

    const dataStr = format === 'json' 
      ? JSON.stringify(report, null, 2)
      : convertToCSV(report);
    
    const dataBlob = new Blob([dataStr], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sistema-relatorio-${reportPeriod}-${new Date().toISOString().split('T')[0]}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: SystemReport) => {
    const rows = [
      ['Categoria', 'Métrica', 'Valor'],
      ['Usuários', 'Total', data.users?.total || 0],
      ['Usuários', 'Ativos', data.users?.active || 0],
      ['Usuários', 'Inativos', data.users?.inactive || 0],
      ['Usuários', 'Administradores', data.users?.admins || 0],
      ['Usuários', 'Novos este mês', data.users?.newThisMonth || 0],
      ['Sermões', 'Total', data.sermons?.total || 0],
      ['Sermões', 'Este mês', data.sermons?.thisMonth || 0],
      ['Sermões', 'Média por usuário', data.sermons?.avgPerUser || 0],
      ['DNA', 'Total de perfis', data.dna?.totalProfiles || 0],
      ['DNA', 'Perfis customizados', data.dna?.customProfiles || 0],
      ['DNA', 'Perfis padrão', data.dna?.defaultProfiles || 0],
      ['RAG', 'Total de documentos', data.rag?.totalDocuments || 0],
      ['RAG', 'Total de fragmentos', data.rag?.totalChunks || 0],
      ['RAG', 'Média de fragmentos por doc', data.rag?.avgChunksPerDoc || 0],
    ];

    return rows.map(row => row.join(',')).join('\n');
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
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Relatórios Avançados</h1>
              <p className="text-muted-foreground">
                Análise detalhada do uso e performance do sistema
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={reportPeriod} 
                onChange={(e) => setReportPeriod(e.target.value as 'week' | 'month' | 'year')}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="week">Última semana</option>
                <option value="month">Último mês</option>
                <option value="year">Último ano</option>
              </select>
              
              <Button variant="outline" onClick={() => exportReport('csv')} disabled={!report}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              
              <Button variant="outline" onClick={() => exportReport('json')} disabled={!report}>
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-red-600">Erro ao carregar relatórios. Tente novamente.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="usage">Uso</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report?.users?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {report?.users?.active || 0} ativos
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Sermões</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report?.sermons?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {report?.sermons?.thisMonth || 0} este mês
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Perfis DNA</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report?.dna?.totalProfiles || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {report?.dna?.customProfiles || 0} customizados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Documentos RAG</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{report?.rag?.totalDocuments || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {report?.rag?.totalChunks || 0} fragmentos
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição de Usuários</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Usuários Ativos:</span>
                        <Badge variant="default">{report?.users?.active || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Usuários Inativos:</span>
                        <Badge variant="secondary">{report?.users?.inactive || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Administradores:</span>
                        <Badge variant="outline">{report?.users?.admins || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Novos este mês:</span>
                        <Badge variant="default">{report?.users?.newThisMonth || 0}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {report?.usage?.topUsers && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Usuários Mais Ativos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {report.usage.topUsers.map((user, index) => (
                          <div key={user.userId} className="flex justify-between items-center">
                            <span className="font-medium">{user.userName}</span>
                            <Badge>{user.sermonCount} sermões</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Estatísticas de Conteúdo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Média de sermões por usuário:</span>
                        <span className="font-medium">{report?.sermons?.avgPerUser?.toFixed(1) || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Média de perfis DNA por usuário:</span>
                        <span className="font-medium">{report?.dna?.avgProfilesPerUser?.toFixed(1) || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Média de fragmentos por documento:</span>
                        <span className="font-medium">{report?.rag?.avgChunksPerDoc?.toFixed(1) || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {report?.sermons?.topThemes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Temas Mais Populares</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {report.sermons.topThemes.map((theme, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span>{theme.theme}</span>
                            <Badge>{theme.count} sermões</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Análise de Uso</CardTitle>
                  <CardDescription>
                    Padrões de uso e atividade do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4" />
                    <p>Relatórios de uso detalhados em desenvolvimento</p>
                    <p className="text-sm">Em breve: gráficos de atividade, horários de pico e análise de tendências</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
      <Footer />
    </div>
  );
}