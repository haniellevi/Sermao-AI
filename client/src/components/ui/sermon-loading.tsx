import { Wand2 } from "lucide-react";

interface SermonLoadingProps {
  isVisible: boolean;
}

export function SermonLoading({ isVisible }: SermonLoadingProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center">
        {/* Logo animada */}
        <div className="relative mb-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center animate-pulse">
            <Wand2 className="w-10 h-10 text-white animate-bounce" />
          </div>
          {/* Círculos animados ao redor da logo */}
          <div className="absolute inset-0 w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping"></div>
            <div className="absolute inset-2 border-2 border-secondary/30 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Texto principal */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Escrevendo o melhor Sermão
        </h2>
        
        {/* Texto descritivo */}
        <p className="text-gray-600 mb-6">
          Nossa IA está analisando seu DNA homilético e criando um sermão personalizado para você...
        </p>

        {/* Barra de progresso animada */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full animate-pulse loading-progress"></div>
        </div>

        {/* Texto de status */}
        <p className="text-sm text-gray-500">
          Isso pode levar alguns instantes...
        </p>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes loading-progress {
            0% { width: 20%; }
            50% { width: 80%; }
            100% { width: 75%; }
          }
          .loading-progress {
            animation: loading-progress 3s ease-in-out infinite;
          }
        `
      }} />
    </div>
  );
}