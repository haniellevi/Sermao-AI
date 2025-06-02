import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Scroll, Dna, Bot, Heart } from "lucide-react";

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12 animate-gentle-fade">
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-full p-6 shadow-lg">
                <Scroll className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Gerador de Sermões com IA
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Crie sermões personalizados com o poder da Inteligência Artificial, 
              adaptados ao seu DNA único de pregador e às necessidades da sua congregação.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <Dna className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">DNA Personalizado</h3>
                <p className="text-gray-600">Analise seu estilo único de pregação</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">IA Avançada</h3>
                <p className="text-gray-600">Powered by Google Gemini</p>
              </CardContent>
            </Card>
            
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <Heart className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Impacto Real</h3>
                <p className="text-gray-600">Sermões que tocam corações</p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="px-8 py-4 text-lg font-semibold shadow-lg">
                <Scroll className="w-5 h-5 mr-2" />
                Fazer Login
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg" className="px-8 py-4 text-lg font-semibold border-2 border-primary text-primary hover:bg-primary hover:text-white">
                <Heart className="w-5 h-5 mr-2" />
                Criar Conta Grátis
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
