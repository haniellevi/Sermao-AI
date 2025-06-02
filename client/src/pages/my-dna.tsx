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
  X,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { createDnaSchema, type CreateDnaRequest } from "@shared/schema";
import { apiRequest } from "@/lib/api";

interface DnaFormData {
  pastedTexts: string[];
  youtubeLinks: string[];
  personalDescription: string;
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
    setValue,
  } = useForm<DnaFormData>({
    resolver: zodResolver(createDnaSchema.omit({ uploadedFiles: true })),
    defaultValues: {
      pastedTexts: ["", "", "", "", ""],
      youtubeLinks: ["", "", ""],
      personalDescription: "",
    },
  });

  const createDnaMutation = useMutation({
    mutationFn: async (data: { files: File[]; pastedTexts: string[]; youtubeLinks: string[]; personalDescription: string }) => {
      const formData = new FormData();
      
      data.files.forEach((file) => {
        formData.append('files', file);
      });
      
      formData.append('pastedTexts', JSON.stringify(data.pastedTexts.filter(text => text.trim())));
      formData.append('youtubeLinks', JSON.stringify(data.youtubeLinks.filter(link => link.trim())));
      formData.append('personalDescription', data.personalDescription || '');

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

  // Função para carregar dados existentes do DNA
  const loadExistingData = () => {
    if (dnaData?.activeProfile) {
      const profile = dnaData.activeProfile;
      
      // Carregar textos colados existentes
      const existingTexts = profile.content ? JSON.parse(profile.content).pastedTexts || [] : [];
      existingTexts.forEach((text: string, index: number) => {
        if (index < 5) {
          setValue(`pastedTexts.${index}`, text);
        }
      });

      // Carregar links do YouTube existentes
      const existingLinks = profile.content ? JSON.parse(profile.content).youtubeLinks || [] : [];
      existingLinks.forEach((link: string, index: number) => {
        if (index < 3) {
          setValue(`youtubeLinks.${index}`, link);
        }
      });

      // Carregar descrição pessoal existente
      const existingDescription = profile.content ? JSON.parse(profile.content).personalDescription || "" : "";
      setValue("personalDescription", existingDescription);
    }
  };

  const onSubmit = (data: DnaFormData) => {
    createDnaMutation.mutate({
      files: uploadedFiles,
      pastedTexts: data.pastedTexts,
      youtubeLinks: data.youtubeLinks,
      personalDescription: data.personalDescription,
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(files => files.filter((_, i) => i !== index));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600">Faça login para acessar seu DNA de pregação.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Meu DNA de Pregação</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Analise seus sermões e pregações para criar um perfil personalizado que será usado na geração de conteúdo.
            </p>
          </div>

          {/* Status Card */}
          <Card className="shadow-lg">
            <CardContent className="p-6">
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
                  <div className="flex items-center text-amber-600">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    <span>DNA padrão ativo - Configure seu DNA personalizado</span>
                  </div>
                )}
              </div>

              <div className="mt-6">
                {!showForm ? (
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      {dnaData?.hasCustomDNA 
                        ? "Você já possui um DNA personalizado. Clique abaixo para visualizar ou atualizar."
                        : "Crie seu DNA personalizado fazendo upload de sermões, colando textos ou adicionando links do YouTube."
                      }
                    </p>
                    <Button
                      onClick={() => {
                        setShowForm(true);
                        if (dnaData?.hasCustomDNA) {
                          loadExistingData();
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      {dnaData?.hasCustomDNA ? "Atualizar DNA" : "Criar DNA Personalizado"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* DNA Creation Form */}
          {showForm && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  {dnaData?.hasCustomDNA ? "Atualizar" : "Criar"} DNA Personalizado
                </CardTitle>
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

                  {/* Personal Description Section */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Edit className="w-5 h-5 text-blue-600 mr-2" />
                      Eu gosto de pregar assim
                    </h4>
                    <div>
                      <Label htmlFor="personal-description" className="text-sm font-medium text-gray-700">
                        Descreva com suas palavras quem é você como pregador, e como você gosta de ministrar a Palavra
                      </Label>
                      <Textarea
                        id="personal-description"
                        rows={6}
                        placeholder="Ex: Sou um pregador expositivo que gosta de conectar as Escrituras com situações práticas do dia a dia. Prefiro usar ilustrações simples e histórias pessoais para tornar a mensagem mais acessível. Meu estilo é conversacional e procuro sempre aplicar a Palavra de forma prática na vida dos ouvintes..."
                        {...register('personalDescription')}
                        className="mt-1"
                      />
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
                    Seu Perfil de Pregação
                  </CardTitle>
                  <Button
                    onClick={() => {
                      setShowForm(true);
                      loadExistingData();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar DNA
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Este é seu perfil personalizado identificado pela análise de IA. Ele é usado automaticamente na geração de seus sermões.
                </p>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-6">
                  {dnaData.activeProfile.type === "customizado" && dnaData.activeProfile.customAttributes ? (
                    <div className="space-y-6">
                      {/* Características principais */}
                      {dnaData.activeProfile.customAttributes.teologia && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Abordagem Teológica
                          </h3>
                          <p className="text-gray-700 bg-white p-3 rounded-lg">{dnaData.activeProfile.customAttributes.teologia}</p>
                        </div>
                      )}

                      {dnaData.activeProfile.customAttributes.estilo && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Estilo de Pregação
                          </h3>
                          <p className="text-gray-700 bg-white p-3 rounded-lg">{dnaData.activeProfile.customAttributes.estilo}</p>
                        </div>
                      )}

                      {dnaData.activeProfile.customAttributes.audiencia && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                            Conexão com a Audiência
                          </h3>
                          <p className="text-gray-700 bg-white p-3 rounded-lg">{dnaData.activeProfile.customAttributes.audiencia}</p>
                        </div>
                      )}

                      {dnaData.activeProfile.customAttributes.linguagem && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                            Linguagem e Comunicação
                          </h3>
                          <p className="text-gray-700 bg-white p-3 rounded-lg">{dnaData.activeProfile.customAttributes.linguagem}</p>
                        </div>
                      )}

                      {dnaData.activeProfile.customAttributes.estrutura && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            Estrutura e Organização
                          </h3>
                          <p className="text-gray-700 bg-white p-3 rounded-lg">{dnaData.activeProfile.customAttributes.estrutura}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-4">
                        <Dna className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Nenhuma característica identificada ainda.</p>
                        <p className="text-sm mt-2">Adicione conteúdo para análise e clique em "Analisar e Salvar DNA".</p>
                      </div>
                    </div>
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