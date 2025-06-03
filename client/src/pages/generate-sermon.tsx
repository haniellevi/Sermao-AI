import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from "@/components/layout/navbar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dna, Settings, Wand2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { generateSermonSchema, type GenerateSermonRequest } from "@shared/schema";
import { apiRequest } from "@/lib/api";
import { SermonLoading } from "@/components/ui/sermon-loading";

export default function GenerateSermonPage() {
  const [, setLocation] = useLocation();
  const [showLoading, setShowLoading] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(Date.now());
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dnaData } = useQuery({
    queryKey: ["/api/user/dna"],
    enabled: !!user,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateSermonRequest>({
    resolver: zodResolver(generateSermonSchema),
    defaultValues: {
      dnaType: dnaData?.hasCustomDNA ? "customizado" : "padrao",
      theme: "",
      purpose: "nenhum",
      audience: "nenhum",
      duration: "",
      style: "nenhum",
      context: "nenhum",
      referenceUrls: "",
    },
  });

  const dnaType = watch("dnaType");

  const generateMutation = useMutation({
    mutationFn: async (data: GenerateSermonRequest) => {
      const response = await apiRequest("POST", "/api/sermon/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate sermons cache to update the list
      queryClient.invalidateQueries({ queryKey: ['/api/sermons'] });
      
      toast({
        title: "Sermão gerado com sucesso!",
        description: "Seu sermão personalizado está pronto.",
      });
      console.log('Resposta da API:', data);
      setLocation(`/sermon-result/${data.sermonId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar sermão",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
    onMutate: () => {
      setLoadingStartTime(Date.now());
      setShowLoading(true);
    },
    onSettled: () => {
      setShowLoading(false);
    },
  });

  const onSubmit = (data: GenerateSermonRequest) => {
    generateMutation.mutate(data);
  };

  if (!user) {
    return null;
  }



  return (
    <>
      <SermonLoading 
        isVisible={showLoading} 
        startTime={loadingStartTime}
        estimatedDuration={25000}
      />
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* DNA Selection */}
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Dna className="w-5 h-5 text-secondary mr-2" />
                Selecione seu DNA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={dnaType}
                onValueChange={(value: "padrao" | "customizado") => setValue("dnaType", value)}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <Label 
                    htmlFor="padrao"
                    className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-primary/30 transition-colors"
                  >
                    <RadioGroupItem value="padrao" id="padrao" className="mr-3" />
                    <div>
                      <div className="font-medium text-gray-900">DNA Padrão</div>
                      <div className="text-sm text-gray-600">Estilo genérico balanceado</div>
                    </div>
                  </Label>
                  
                  <Label 
                    htmlFor="customizado"
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      dnaData?.hasCustomDNA 
                        ? "border-primary/20 bg-primary/5 hover:border-primary/30" 
                        : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <RadioGroupItem 
                      value="customizado" 
                      id="customizado" 
                      className="mr-3"
                      disabled={!dnaData?.hasCustomDNA}
                    />
                    <div>
                      <div className="font-medium text-gray-900">Meu DNA Customizado</div>
                      <div className="text-sm text-gray-600">
                        {dnaData?.hasCustomDNA ? "Baseado no seu estilo único" : "Configure seu DNA primeiro"}
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Sermon Configuration Form */}
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 text-primary mr-2" />
                Configure seu Sermão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Campos obrigatórios:</strong> Tema do Sermão e Duração são necessários para gerar um sermão de qualidade.
                </p>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Theme */}
                  <div className="md:col-span-2">
                    <Label htmlFor="theme" className="flex items-center">
                      Tema do Sermão <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="theme"
                      placeholder="Ex: A Graça Transformadora de Deus"
                      {...register("theme")}
                      className={`mt-1 ${errors.theme ? 'border-red-500' : ''}`}
                    />
                    {errors.theme && (
                      <p className="text-sm text-destructive mt-1">{errors.theme.message}</p>
                    )}
                  </div>

                  {/* Purpose */}
                  <div>
                    <Label htmlFor="purpose">Propósito da Pregação</Label>
                    <Select onValueChange={(value) => setValue("purpose", value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o propósito" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        <SelectItem value="inspirar">Inspirar</SelectItem>
                        <SelectItem value="confrontar">Confrontar</SelectItem>
                        <SelectItem value="ensinar">Ensinar</SelectItem>
                        <SelectItem value="consolar">Consolar</SelectItem>
                        <SelectItem value="mobilizar">Mobilizar para ação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target Audience */}
                  <div>
                    <Label htmlFor="audience">Público-alvo</Label>
                    <Select onValueChange={(value) => setValue("audience", value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o público" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        <SelectItem value="jovens">Jovens</SelectItem>
                        <SelectItem value="familias">Famílias</SelectItem>
                        <SelectItem value="lideres">Líderes</SelectItem>
                        <SelectItem value="congregacao-geral">Congregação geral</SelectItem>
                        <SelectItem value="homens">Homens</SelectItem>
                        <SelectItem value="mulheres">Mulheres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration */}
                  <div>
                    <Label htmlFor="duration" className="flex items-center">
                      Duração Aproximada <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Select onValueChange={(value) => setValue("duration", value)}>
                      <SelectTrigger className={`mt-1 ${errors.duration ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Selecione a duração" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10-minutos">10 minutos</SelectItem>
                        <SelectItem value="15-minutos">15 minutos</SelectItem>
                        <SelectItem value="30-minutos">30 minutos</SelectItem>
                        <SelectItem value="45-minutos">45 minutos</SelectItem>
                        <SelectItem value="60-minutos">60 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.duration && (
                      <p className="text-sm text-destructive mt-1">{errors.duration.message}</p>
                    )}
                  </div>

                  {/* Preaching Style */}
                  <div>
                    <Label htmlFor="style">Estilo de Pregação Preferencial</Label>
                    <Select onValueChange={(value) => setValue("style", value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o estilo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        <SelectItem value="topico">Tópico</SelectItem>
                        <SelectItem value="expositivo">Expositivo</SelectItem>
                        <SelectItem value="textual">Textual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Context */}
                  <div className="md:col-span-2">
                    <Label htmlFor="context">Contexto Específico</Label>
                    <Select onValueChange={(value) => setValue("context", value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o contexto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        <SelectItem value="culto">Culto</SelectItem>
                        <SelectItem value="casamento">Casamento</SelectItem>
                        <SelectItem value="funeral">Funeral</SelectItem>
                        <SelectItem value="estudo-biblico">Estudo Bíblico</SelectItem>
                        <SelectItem value="celula">Célula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference URLs */}
                  <div className="md:col-span-2">
                    <Label htmlFor="referenceUrls">URLs de Sermões de Referência Online (opcional)</Label>
                    <Textarea
                      id="referenceUrls"
                      rows={3}
                      placeholder="Cole aqui links de sermões que possam servir de referência ou inspiração..."
                      {...register("referenceUrls")}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <div className="text-center pt-6">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={generateMutation.isPending}
                    className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 px-12 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Gerando com IA...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 mr-3" />
                        Gerar Sermão com IA
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">Isso pode levar alguns segundos...</p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
