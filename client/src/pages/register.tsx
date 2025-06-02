import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { UserPlus, ArrowLeft, Eye, EyeOff, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { apiRequest } from "@/lib/api";

const registerFormSchema = insertUserSchema.extend({
  acceptTerms: insertUserSchema.shape.email.pipe(
    insertUserSchema.shape.email.refine(() => true, "Você deve aceitar os termos de uso")
  ).optional(),
});

type RegisterFormData = InsertUser & { acceptTerms?: boolean };

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      login(data.user, data.token);
      toast({
        title: "Conta criada com sucesso",
        description: `Bem-vindo à nossa comunidade, ${data.user.name}!`,
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    if (!acceptTerms) {
      toast({
        title: "Termos de uso",
        description: "Você deve aceitar os termos de uso para continuar",
        variant: "destructive",
      });
      return;
    }

    const { acceptTerms: _, ...registerData } = data;
    registerMutation.mutate(registerData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-green-600 mx-auto" />
              </div>
              <CardTitle className="text-2xl font-bold">Criar Conta</CardTitle>
              <p className="text-muted-foreground">Junte-se à nossa comunidade</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    {...register("name")}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    {...register("email")}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      {...register("password")}
                      className={errors.password ? "border-destructive pr-10" : "pr-10"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground mt-2">
                    <Info className="w-3 h-3 mr-1" />
                    Use ao menos 8 caracteres com letras e números
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="accept-terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  />
                  <Label htmlFor="accept-terms" className="text-sm leading-5">
                    Aceito os{" "}
                    <Button variant="link" className="p-0 h-auto text-primary">
                      Termos de Uso
                    </Button>{" "}
                    e{" "}
                    <Button variant="link" className="p-0 h-auto text-primary">
                      Política de Privacidade
                    </Button>
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Cadastrar
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <div className="text-sm text-muted-foreground">
                  Já tem conta?{" "}
                  <Link href="/login">
                    <Button variant="link" className="p-0 h-auto text-primary font-medium">
                      Fazer login
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/">
            <Button variant="ghost" className="mt-6 w-full text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}