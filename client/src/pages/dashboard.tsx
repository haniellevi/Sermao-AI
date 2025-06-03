import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Dna, Wand2, Clock, FileText, CheckCircle, Calendar, BookOpen } from "lucide-react";
import { useAuthContext } from "@/lib/auth";

export default function DashboardPage() {
  const { user } = useAuthContext();

  const { data: dnaData } = useQuery({
    queryKey: ["/api/user/dna"],
    enabled: !!user,
  });

  const { data: sermonsData } = useQuery({
    queryKey: ["/api/sermons"],
    enabled: !!user,
  });

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-gentle-fade">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo, {user.name}!
          </h2>
          <p className="text-gray-600">Que Deus abençoe seu ministério hoje. O que você gostaria de fazer?</p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* DNA Card */}
          <Link href="/my-dna">
            <Card className="shadow-lg hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-secondary/10 rounded-full p-3 group-hover:bg-secondary/20 transition-colors">
                    <Dna className="w-8 h-8 text-secondary" />
                  </div>
                  {dnaData?.hasCustomDNA ? (
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ativo
                    </div>
                  ) : (
                    <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                      Pendente
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Meu DNA de Pregador</h3>
                <p className="text-gray-600 text-sm mb-4">Personalize seu estilo único de pregação</p>
                <div className="flex items-center text-secondary text-sm font-medium group-hover:text-secondary/80">
                  <span>Gerenciar DNA</span>
                  <div className="ml-2 transform group-hover:translate-x-1 transition-transform">→</div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Generate Sermon Card */}
          <Link href="/generate-sermon">
            <Card className="shadow-lg hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-primary/10 rounded-full p-3 group-hover:bg-primary/20 transition-colors">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    IA
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Gerar Novo Sermão</h3>
                <p className="text-gray-600 text-sm mb-4">Crie sermões personalizados com IA</p>
                <div className="flex items-center text-primary text-sm font-medium group-hover:text-primary/80">
                  <span>Começar agora</span>
                  <div className="ml-2 transform group-hover:translate-x-1 transition-transform">→</div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Document Library Card */}
          <Link href="/document-library">
            <Card className="shadow-lg hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-100 rounded-full p-3 group-hover:bg-blue-200 transition-colors">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                    Biblioteca
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentos Teológicos</h3>
                <p className="text-gray-600 text-sm mb-4">Enriqueça sermões com seus documentos</p>
                <div className="flex items-center text-blue-600 text-sm font-medium group-hover:text-blue-500">
                  <span>Gerenciar biblioteca</span>
                  <div className="ml-2 transform group-hover:translate-x-1 transition-transform">→</div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* History Card */}
          <Link href="/history">
            <Card className="shadow-lg hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-emerald-100 rounded-full p-3 group-hover:bg-emerald-200 transition-colors">
                    <Clock className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                    {Array.isArray(sermonsData) ? sermonsData.length : 0} sermões
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Histórico</h3>
                <p className="text-gray-600 text-sm mb-4">Acesse seus sermões anteriores</p>
                <div className="flex items-center text-emerald-600 text-sm font-medium group-hover:text-emerald-500">
                  <span>Ver histórico</span>
                  <div className="ml-2 transform group-hover:translate-x-1 transition-transform">→</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Activity */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h3>
            <div className="space-y-3">
              {Array.isArray(sermonsData) && sermonsData.slice(0, 3).map((sermon: any) => {
                let qualityScore = 'N/A';
                try {
                  const content = JSON.parse(sermon.content);
                  if (content.avaliacao_qualidade && typeof content.avaliacao_qualidade === 'object') {
                    qualityScore = content.avaliacao_qualidade.nota || 'N/A';
                  } else if (content.avaliacao_qualidade && typeof content.avaliacao_qualidade === 'string') {
                    // Try to extract score from string
                    const scoreMatch = content.avaliacao_qualidade.match(/(\d+(?:\.\d+)?)/);
                    qualityScore = scoreMatch ? scoreMatch[1] : 'N/A';
                  }
                } catch {
                  qualityScore = 'N/A';
                }
                
                return (
                  <Link key={sermon.id} href={`/sermon-result/${sermon.id}`}>
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="bg-primary/10 rounded-full p-2 mr-3">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Sermão "{sermon.title}" gerado
                        </p>
                        <p className="text-xs text-gray-500 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(sermon.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {qualityScore !== 'N/A' ? `${qualityScore}/10` : 'N/A'}
                      </div>
                    </div>
                  </Link>
                );
              }) || (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum sermão gerado ainda</p>
                  <p className="text-sm">Comece criando seu primeiro sermão!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
