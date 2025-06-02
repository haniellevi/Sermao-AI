import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { 
  FileText, 
  Copy, 
  RotateCcw, 
  Save, 
  Share2, 
  Star, 
  Lightbulb,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function SermonResultPage() {
  const [, params] = useRoute("/sermon-result/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: sermonData, isLoading, error } = useQuery({
    queryKey: ["/api/sermons", params?.id],
    enabled: !!user && !!params?.id,
  });

  const copyToClipboard = async () => {
    if (!sermonData?.sermon) return;

    const sermon = sermonData.sermon.content;
    let textContent = `${sermon.titulo}\n\n`;
    textContent += `Texto Base: ${sermon.texto_base}\n\n`;
    textContent += `${sermon.introducao}\n\n`;
    
    sermon.desenvolvimento?.forEach((ponto: any, index: number) => {
      textContent += `${index + 1}. ${ponto.ponto}\n${ponto.conteudo}\n\n`;
    });
    
    textContent += `Aplicação Prática:\n${sermon.aplicacao_pratica}\n\n`;
    textContent += `Conclusão:\n${sermon.conclusao}\n\n`;
    textContent += `Oração Final:\n${sermon.oracao_final}`;

    try {
      await navigator.clipboard.writeText(textContent);
      toast({
        title: "Sermão copiado!",
        description: "O conteúdo foi copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o conteúdo.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-gray-600">Carregando sermão...</p>
              </CardContent>
            </Card>
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
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg">
              <CardContent className="p-8 text-center">
                <p className="text-red-600">Erro ao carregar o sermão.</p>
                <Button onClick={() => setLocation("/generate-sermon")} className="mt-4">
                  Voltar para geração
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const sermon = sermonData.sermon.content;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Sermon Content */}
          <Card className="shadow-lg mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold flex items-center">
                  <FileText className="w-6 h-6 mr-2" />
                  {sermon.titulo}
                </CardTitle>
                <Button onClick={copyToClipboard} className="bg-primary hover:bg-primary/90">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Sermão
                </Button>
              </div>
              {sermon.texto_base && (
                <p className="text-muted-foreground">Baseado em {sermon.texto_base}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="sermon-content space-y-6">
                {sermon.introducao && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Introdução</h2>
                    <p className="text-gray-700 leading-relaxed">{sermon.introducao}</p>
                  </div>
                )}

                {sermon.desenvolvimento && sermon.desenvolvimento.map((ponto: any, index: number) => (
                  <div key={index}>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">
                      {index + 1}. {ponto.ponto}
                    </h2>
                    <p className="text-gray-700 leading-relaxed">{ponto.conteudo}</p>
                  </div>
                ))}

                {sermon.aplicacao_pratica && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Aplicação Prática</h2>
                    <p className="text-gray-700 leading-relaxed">{sermon.aplicacao_pratica}</p>
                  </div>
                )}

                {sermon.conclusao && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">Conclusão</h2>
                    <p className="text-gray-700 leading-relaxed">{sermon.conclusao}</p>
                  </div>
                )}

                {sermon.oracao_final && (
                  <div className="bg-primary/5 border-l-4 border-primary p-6 rounded-lg">
                    <h3 className="font-semibold text-primary mb-2">Oração Final</h3>
                    <p className="text-gray-700 italic leading-relaxed">{sermon.oracao_final}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quality Assessment & Suggestions */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Quality Assessment */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="w-5 h-5 text-yellow-500 mr-2" />
                  Avaliação de Qualidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold text-green-600">
                    {sermon.qualidade_score || sermonData.sermon.qualityScore}/10
                  </div>
                  <div className="text-gray-600">Excelente qualidade</div>
                </div>
                
                {sermon.justificativa_qualidade && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Justificativa:</strong> {sermon.justificativa_qualidade}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhancement Suggestions */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lightbulb className="w-5 h-5 text-yellow-500 mr-2" />
                  Sugestões de Enriquecimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(sermon.sugestoes_enriquecimento || sermonData.sermon.suggestions || []).map((suggestion: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={copyToClipboard} className="bg-primary hover:bg-primary/90">
              <Copy className="w-4 h-4 mr-2" />
              Copiar Sermão Completo
            </Button>
            <Button 
              onClick={() => setLocation("/generate-sermon")}
              className="bg-secondary hover:bg-secondary/90"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Gerar Novamente
            </Button>
            <Button variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Salvar no Histórico
            </Button>
            <Button variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
