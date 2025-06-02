import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Navbar } from "@/components/layout/navbar";
import { FileUpload } from "@/components/ui/file-upload";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dna, 
  Upload, 
  Edit, 
  Download, 
  Youtube, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Wand2,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { createDnaSchema, type CreateDnaRequest } from "@shared/schema";
import { apiRequest } from "@/lib/api";

interface DnaFormData {
  pastedTexts: string[];
  youtubeLinks: string[];
}

export default function MyDNAPage() {
  const [showForm, setShowForm] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dnaData, isLoading } = useQuery({
    queryKey: ["/api/user/dna"],
    enabled: !!user,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DnaFormData>({
    resolver: zodResolver(createDnaSchema.omit({ uploadedFiles: true })),
    defaultValues: {
      pastedTexts: ["", "", "", "", ""],
      youtubeLinks: ["", "", ""],
    },
  });

  const createDnaMutation = useMutation({
    mutationFn: async (data: { files: File[]; pastedTexts: string[]; youtubeLinks: string[] }) => {
      const formData = new FormData();
      
      data.files.forEach((file) => {
        formData.append('files', file);
      });
      
      formData.append('pastedTexts', JSON.stringify(data.pastedTexts.filter(text => text.trim())));
      formData.append('youtubeLinks', JSON.stringify(data.youtubeLinks.filter(link => link.trim())));

      const response = await fetch('/api/user/dna', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create DNA');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "DNA processado com sucesso!",
        description: "Seu perfil de pregador foi atualizado com base na análise de IA.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/dna"] });
      setShowForm(false);
      setUploadedFiles([]);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao processar DNA",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DnaFormData) => {
    if (uploadedFiles.length === 0 && !data.pastedTexts.some(text => text.trim()) && !data.youtubeLinks.some(link => link.trim())) {
      toast({
        title: "Conteúdo necessário",
        description: "Adicione pelo menos um arquivo, texto ou link do YouTube para análise.",
        variant: "destructive",
      });
      return;
    }

    createDnaMutation.mutate({
      files: uploadedFiles,
      pastedTexts: data.pastedTexts,
      youtubeLinks: data.youtubeLinks,
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Status Section */}
        <Card className="shadow-lg mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Status do seu DNA</h2>
                {isLoading ? (
                  <div className="flex items-center text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2" />
                    <span>Carregando...</span>
                  </div>
                ) : dnaData?.hasCustomDNA ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span>Seu DNA customizado já está definido</span>
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-600">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    <span>Você ainda não tem um DNA customizado</span>
                  </div>
                )}
              </div>
              {dnaData?.activeProfile && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">Última atualização</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {new Date(dnaData.activeProfile.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {!dnaData?.hasCustomDNA ? (
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-secondary hover:bg-secondary/90"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Gerar Meu DNA
                </Button>
              ) : (
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Atualizar Meu DNA
                </Button>
              )}
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar DNA
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* DNA Form */}
        {showForm && (
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Configurar DNA Personalizado</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* File Upload Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Upload className="w-5 h-5 text-primary mr-2" />
                    Upload de Sermões (até 5 arquivos)
                  </h4>
                  <FileUpload
                    onFilesChange={setUploadedFiles}
                    files={uploadedFiles}
                    maxFiles={5}
                    acceptedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']}
                  />
                  
                  {/* File List */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-blue-500 mr-3" />
                            <span className="text-gray-900">{file.name}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              ({(file.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Text Input Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 text-secondary mr-2" />
                    Pregações em Texto (até 5)
                  </h4>
                  <div className="space-y-4">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div key={index}>
                        <Label htmlFor={`text-${index}`} className="text-sm font-medium text-gray-700">
                          Pregação {index + 1}
                        </Label>
                        <Textarea
                          id={`text-${index}`}
                          rows={4}
                          placeholder="Cole aqui o texto completo de uma pregação sua..."
                          {...register(`pastedTexts.${index}` as const)}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* YouTube Links Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Youtube className="w-5 h-5 text-red-600 mr-2" />
                    Links do YouTube (até 3)
                  </h4>
                  <div className="space-y-4">
                    {[0, 1, 2].map((index) => (
                      <div key={index}>
                        <Label htmlFor={`youtube-${index}`} className="text-sm font-medium text-gray-700">
                          Link {index + 1}
                        </Label>
                        <Input
                          id={`youtube-${index}`}
                          type="url"
                          placeholder="https://youtube.com/watch?v=..."
                          {...register(`youtubeLinks.${index}` as const)}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-between items-center pt-6 border-t">
                  <Button 
                    type="button" 
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createDnaMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createDnaMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Analisando com IA...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Analisar e Salvar DNA
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Current DNA Preview */}
        {dnaData?.activeProfile && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <Dna className="w-5 h-5 mr-2" />
                  Preview do DNA Atual
                </CardTitle>
                <Button
                  onClick={() => setShowForm(true)}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar DNA
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-6">
                {dnaData.activeProfile.type === "customizado" && dnaData.activeProfile.customAttributes ? (
                  <div className="space-y-8">
                    {/* Linguagem Verbal */}
                    {dnaData.activeProfile.customAttributes.linguagemVerbal && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Linguagem Verbal</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Formalidade</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.linguagemVerbal.formalidade || "Não identificado"}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Vocabulário</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.linguagemVerbal.vocabulario || "Não identificado"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <h4 className="font-medium text-gray-900 mb-1">Palavras-chave e Frases de Efeito</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.linguagemVerbal.palavrasChaveFrasesEfeito || "Não identificado"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tom e Comunicação */}
                    {dnaData.activeProfile.customAttributes.tomEComunicacao && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Tom e Comunicação</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Tom Geral</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.tomEComunicacao.tomGeral || "Não identificado"}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Paixão e Intensidade</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.tomEComunicacao.nivelPaixaoIntensidade || "Não identificado"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Estrutura e Estilo Homilético */}
                    {dnaData.activeProfile.customAttributes.estruturaESiloHomiletico && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Estrutura e Estilo Homilético</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Estilo Principal</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.estruturaESiloHomiletico.estiloPrincipal || "Não identificado"}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Introdução</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.estruturaESiloHomiletico.introducao || "Não identificado"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <h4 className="font-medium text-gray-900 mb-1">Uso de Ilustrações</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.estruturaESiloHomiletico.usoIlustracoesAnalogias || "Não identificado"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Linha Teológica */}
                    {dnaData.activeProfile.customAttributes.linhaTeologicaEInterpretativa && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Linha Teológica e Interpretativa</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Visão Geral</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.linhaTeologicaEInterpretativa.visaoGeral || "Não identificado"}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Abordagem Hermenêutica</h4>
                            <p className="text-gray-600 text-sm">{dnaData.activeProfile.customAttributes.linhaTeologicaEInterpretativa.abordagemHermeneutica || "Não identificado"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Estilo de Pregação</h4>
                      <p className="text-gray-600 text-sm">Equilibrado e pastoral</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Tom Predominante</h4>
                      <p className="text-gray-600 text-sm">Inspirador e acolhedor</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Estrutura Preferida</h4>
                      <p className="text-gray-600 text-sm">Introdução, desenvolvimento em 3 pontos, conclusão prática</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Temas Recorrentes</h4>
                      <p className="text-gray-600 text-sm">Graça, amor, esperança, transformação</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
