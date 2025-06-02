import { useEffect, useState } from 'react';
import { Wand2 } from "lucide-react";

interface SermonLoadingProps {
  isVisible: boolean;
  startTime?: number;
  estimatedDuration?: number; // in milliseconds
}

export function SermonLoading({ 
  isVisible, 
  startTime = Date.now(), 
  estimatedDuration = 25000 // 25 seconds default
}: SermonLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);

  const phases = [
    "Analisando seu DNA homilético...",
    "Estruturando o sermão...",
    "Desenvolvendo os pontos principais...",
    "Criando sugestões de enriquecimento...",
    "Finalizando os últimos detalhes..."
  ];

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      setTimeElapsed(elapsed);
      
      // Calculate progress based on elapsed time vs estimated duration
      const progressPercent = Math.min((elapsed / estimatedDuration) * 100, 95);
      setProgress(progressPercent);
      
      // Update phase based on progress
      const phaseIndex = Math.min(Math.floor(progressPercent / 20), phases.length - 1);
      setCurrentPhase(phaseIndex);
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible, startTime, estimatedDuration]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

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
        
        {/* Texto descritivo dinâmico */}
        <p className="text-gray-600 mb-2">
          {phases[currentPhase]}
        </p>
        
        {/* Tempo decorrido */}
        <p className="text-sm text-gray-500 mb-6">
          Tempo decorrido: {formatTime(timeElapsed)}
        </p>

        {/* Barra de progresso sincronizada */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div 
            className="bg-gradient-to-r from-primary to-secondary h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Percentual de progresso */}
        <div className="flex justify-between text-xs text-gray-500 mb-4">
          <span>0%</span>
          <span className="font-medium">{Math.round(progress)}%</span>
          <span>100%</span>
        </div>

        {/* Texto de status */}
        <p className="text-sm text-gray-500">
          {progress > 90 ? "Quase pronto..." : "Isso pode levar alguns instantes..."}
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