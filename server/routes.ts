
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { 
  loginSchema, 
  passwordResetRequestSchema, 
  passwordResetConfirmSchema,
  generateSermonSchema,
  createDnaSchema,
  type User
} from "../shared/schema";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ragService } from "./ragService";
import { db } from "./db";
import { users, sermons, dnaProfiles, ragChunks } from "../shared/schema";
import { sql, eq } from "drizzle-orm";

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'sermon-generator-secret';

// Google Gemini AI Configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// JWT middleware
interface AuthRequest extends Express.Request {
  user?: User;
  body: any;
  params: any;
  headers: any;
  method: string;
  url: string;
}

const authenticateToken = async (req: AuthRequest, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('[Auth] Authentication attempt:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    method: (req as any).method,
    url: (req as any).url,
    userAgent: req.headers['user-agent']?.substring(0, 50),
    timestamp: new Date().toISOString()
  });

  if (!token) {
    console.log('[Auth] No token provided - returning 401');
    return res.status(401).json({ message: 'Token de acesso necessário' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    console.log('[Auth] Token decoded successfully:', { userId: decoded.userId });

    const user = await storage.getUser(decoded.userId);

    if (!user) {
      console.log('[Auth] User not found for ID:', decoded.userId);
      return res.status(401).json({ message: 'Token inválido' });
    }

    console.log('[Auth] Authentication successful for user:', {
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
    req.user = user;
    next();
  } catch (error: any) {
    console.log('[Auth] Token validation error:', {
      name: error.name,
      message: error.message,
      tokenPreview: token.substring(0, 20) + '...',
      timestamp: new Date().toISOString()
    });
    return res.status(403).json({ message: 'Token inválido ou expirado' });
  }
};

// Helper functions
const generateToken = (userId: number): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// YouTube transcription function (mock implementation)
const transcribeYouTubeVideo = async (url: string): Promise<{ text: string, duration_minutes: number }> => {
  // Mock implementation - in production, integrate with actual transcription service
  const mockTranscriptions = [
    { text: "Amados irmãos, hoje vamos falar sobre o amor de Deus que nos transforma. O Senhor Jesus nos ensina que o amor é a base de tudo. Quando amamos verdadeiramente, seguimos os passos do Mestre. A palavra de Deus nos revela que o amor não é apenas um sentimento, mas uma decisão. Decidimos amar mesmo quando é difícil. Decidimos amar mesmo quando não sentimos vontade. Porque o amor de Cristo nos constrange.", duration_minutes: 8.5 },
    { text: "A fé é o fundamento da vida cristã. Sem fé é impossível agradar a Deus. Hebreus 11:6 nos ensina claramente isso. Mas o que é fé? Fé é confiança absoluta em Deus. É crer mesmo quando não vemos. É ter certeza das coisas que esperamos. A fé nos move montanhas, a fé nos dá esperança, a fé nos transforma.", duration_minutes: 12.3 },
    { text: "Irmãos, a oração é nossa comunicação direta com o Pai. Jesus nos ensinou a orar. O Pai Nosso é o modelo perfeito de oração. Começamos reconhecendo a santidade de Deus. Pedimos que Sua vontade seja feita. Buscamos o pão diário. Perdoamos como fomos perdoados. E confiamos na proteção divina contra o mal.", duration_minutes: 15.7 }
  ];
  
  // Return random mock data
  const randomIndex = Math.floor(Math.random() * mockTranscriptions.length);
  return mockTranscriptions[randomIndex];
};

// AI helper functions
const callGemini = async (prompt: string, isLongForm = false): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: isLongForm ? "gemini-1.5-pro" : "gemini-1.5-flash" 
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return responseText;
  } catch (error: any) {
    console.error('Gemini AI error:', error);

    // Check if it's a quota exceeded error
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
      throw new Error('Limite de uso da IA atingido. Uma nova chave de API é necessária para continuar gerando sermões.');
    }

    throw new Error('Falha na comunicação com a IA');
  }
};

const callGeminiChatModel = async (messages: any[], isLongForm = false): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: isLongForm ? "gemini-1.5-pro" : "gemini-1.5-flash" 
    });

    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessage = messages.find(m => m.role === 'user');
    
    let prompt = '';
    if (systemMessage) {
      prompt += systemMessage.parts[0].text + '\n\n';
    }
    if (userMessage) {
      prompt += userMessage.parts[0].text;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return responseText;
  } catch (error: any) {
    console.error('Gemini AI Chat error:', error);

    // Check if it's a quota exceeded error
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
      throw new Error('Limite de uso da IA atingido. Uma nova chave de API é necessária para continuar gerando sermões.');
    }

    throw new Error('Falha na comunicação com a IA');
  }
};

// DNA processing function
const processDNA = async (
  userId: number, 
  files: Express.Multer.File[], 
  pastedTexts: string[], 
  youtubeLinks: string[],
  personalDescription: string
): Promise<Record<string, any>> => {
  try {
    // Read system prompt from file
    const systemPromptPath = path.join(process.cwd(), 'backend', 'prompts', 'AGENTE_CRIADOR_DNA.txt');
    const systemPromptContent = fs.readFileSync(systemPromptPath, 'utf8');

    // Create analysis content
    let contentForAnalysis = '';

    // Add personal description
    if (personalDescription.trim()) {
      contentForAnalysis += 'DESCRIÇÃO PESSOAL DO PREGADOR:\n' + personalDescription + '\n\n';
    }

    // Add pasted texts
    if (pastedTexts.length > 0) {
      contentForAnalysis += 'TEXTOS FORNECIDOS:\n' + pastedTexts.join('\n\n') + '\n\n';
    }

    // Process YouTube links with duration and word count metrics
    let total_video_duration_minutes = 0;
    let total_video_words = 0;
    let video_details = [];

    if (youtubeLinks.length > 0) {
      contentForAnalysis += 'LINKS DO YOUTUBE:\n';
      
      for (const link of youtubeLinks) {
        if (link && link.trim()) {
          try {
            // Mock data for demonstration - in production, use actual transcription service
            const transcription_data = await transcribeYouTubeVideo(link);
            const transcription_text = transcription_data.text;
            const video_duration = transcription_data.duration_minutes;

            if (transcription_text && video_duration > 0) {
              const word_count = transcription_text.split(/\s+/).length;
              const ppm = (word_count / video_duration).toFixed(2);
              
              total_video_words += word_count;
              total_video_duration_minutes += video_duration;
              
              video_details.push(`- Vídeo: ${link}, Duração: ${video_duration} min, Palavras: ${word_count}, PPM: ${ppm}`);
              contentForAnalysis += `\n[Transcrição de Vídeo ${link} (${video_duration} min)]:\n${transcription_text}\n`;
            } else {
              contentForAnalysis += `${link} (Transcrição não disponível)\n`;
            }
          } catch (error) {
            console.log(`Erro ao processar vídeo ${link}:`, error);
            contentForAnalysis += `${link} (Erro na transcrição)\n`;
          }
        }
      }

      // Add video metrics summary
      if (total_video_duration_minutes > 0) {
        const average_ppm = (total_video_words / total_video_duration_minutes).toFixed(2);
        contentForAnalysis += `\n--- MÉTRICAS GERAIS DE VÍDEOS DE PREGAÇÃO ---\n`;
        contentForAnalysis += `Duração total dos vídeos analisados: ${total_video_duration_minutes.toFixed(2)} minutos.\n`;
        contentForAnalysis += `Velocidade média de fala identificada: ${average_ppm} palavras por minuto (PPM).\n`;
        contentForAnalysis += `Detalhes por vídeo:\n${video_details.join('\n')}\n`;
      }
      
      contentForAnalysis += '\n';
    }

    // Add file information
    if (files.length > 0) {
      contentForAnalysis += 'ARQUIVOS ENVIADOS:\n';
      files.forEach(file => {
        contentForAnalysis += `- ${file.originalname} (${file.mimetype})\n`;
      });
    }

    // If no content provided, create default profile
    if (!contentForAnalysis.trim()) {
      return {
        linguagemVerbal: {
          formalidade: "Equilibrada, transita entre termos formais e coloquiais",
          vocabulario: "Simples e direto, visando clareza máxima para qualquer ouvinte",
          palavrasChaveFrasesEfeito: "Não identificável",
          clarezaPrecisao: "Linguagem cristalina, conceitos complexos explicados com analogias simples",
          sintaxeFrasal: "Frases curtas, diretas e impactantes, estilo telegráfico",
          ritmoDaFala: "Pausado e reflexivo, com ênfase nas palavras-chave"
        },
        tomEComunicacao: {
          tomGeral: "Inspirador e encorajador, com um calor pastoral evidente",
          nivelPaixaoIntensidade: "Calmo e ponderado, transmitindo autoridade serena",
          usoPerguntasRetoricas: "Usa perguntas pontuais para transição, sem esperar resposta",
          chamadasAcao: "Mais focado na reflexão e na transformação gradual do que na ação imediata"
        },
        estruturaESiloHomiletico: {
          estiloPrincipal: "Expositivo predominante, desdobrando o texto quase verso a verso",
          introducao: "Começa diretamente com a leitura e explanação do texto bíblico",
          desenvolvimentoCorpo: "Claro desenvolvimento em 3 a 5 pontos principais, numerados e facilmente memorizáveis",
          transicoes: "Transições suaves e lógicas entre os pontos, usando frases-ponte bem construídas",
          conclusao: "Recapitula pontos principais e faz um apelo final forte, convidando à decisão ou mudança",
          usoIlustracoesAnalogias: "Foca mais na explicação do texto do que em ilustrações longas"
        },
        linhaTeologicaEInterpretativa: {
          enfasesDoutrinarias: "Foca na graça e no perdão como fundamentos da salvação e vida cristã",
          abordagemHermeneutica: "Prioriza a interpretação histórico-gramatical do texto, buscando o sentido original",
          fontesAutoridade: "Foco exclusivo na Bíblia como única regra de fé e prática",
          visaoGeral: "Teologia equilibrada com ênfase na aplicação prática"
        },
        recursosRetoricosEDidaticos: {
          figurasLinguagem: "Uso moderado de metáforas, símiles e parábolas",
          usoHumor: "Sério e direto, com pouco ou nenhum uso de humor",
          interacaoAudiencia: "Pouca interação direta, estilo mais expositivo unidirecional",
          didaticaEspecifica: "Faz resumos periódicos para reforçar aprendizagem",
          linguagemInclusiva: "Linguagem mais tradicional, focada em pronomes distintos"
        }
      };
    }

    // Create user message content with DNA analysis request
    const userMessageContent = `
CONTEÚDO PARA ANÁLISE:
${contentForAnalysis}

Formato de Saída (JSON - Estritamente neste formato):
Seu retorno DEVE ser um objeto JSON, estritamente no formato abaixo. Seja o mais detalhado e descritivo possível em cada campo. Se uma característica não for identificável, use "Não identificável" ou "Pouco evidente", mas esforce-se para inferir.

{
  "linguagemVerbal": {
    "formalidade": "string",
    "vocabulario": "string", 
    "palavrasChaveFrasesEfeito": "string",
    "clarezaPrecisao": "string",
    "sintaxeFrasal": "string",
    "ritmoDaFala": "string"
  },
  "tomEComunicacao": {
    "tomGeral": "string",
    "nivelPaixaoIntensidade": "string", 
    "usoPerguntasRetoricas": "string",
    "chamadasAcao": "string"
  },
  "estruturaESiloHomiletico": {
    "estiloPrincipal": "string",
    "introducao": "string",
    "desenvolvimentoCorpo": "string",
    "transicoes": "string",
    "conclusao": "string",
    "usoIlustracoesAnalogias": "string"
  },
  "linhaTeologicaEInterpretativa": {
    "enfasesDoutrinarias": "string",
    "abordagemHermeneutica": "string",
    "fontesAutoridade": "string",
    "visaoGeral": "string"
  },
  "recursosRetoricosEDidaticos": {
    "figurasLinguagem": "string",
    "usoHumor": "string",
    "interacaoAudiencia": "string",
    "didaticaEspecifica": "string",
    "linguagemInclusiva": "string"
  }
}

Retorne APENAS o JSON, sem texto adicional antes ou depois.`;

    // Create messages for Gemini
    const messagesForGemini = [
      { "role": "system", "parts": [{ "text": systemPromptContent }] },
      { "role": "user", "parts": [{ "text": userMessageContent }] }
    ];

    const response = await callGeminiChatModel(messagesForGemini);

    try {
      // Clean the response to remove markdown formatting
      let cleanedResponse = response.trim();

      // Remove markdown code block markers
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Erro ao processar resposta da IA:', parseError);
      console.error('Resposta original da IA:', response);
      return {
        linguagemVerbal: {
          formalidade: "Análise baseada no conteúdo fornecido",
          vocabulario: "Vocabulário identificado no material",
          palavrasChaveFrasesEfeito: "Frases características observadas",
          clarezaPrecisao: "Padrão de clareza identificado",
          sintaxeFrasal: "Estrutura frasal observada",
          ritmoDaFala: "Ritmo comunicativo identificado"
        },
        tomEComunicacao: {
          tomGeral: "Tom pastoral identificado no conteúdo",
          nivelPaixaoIntensidade: "Intensidade observada na comunicação",
          usoPerguntasRetoricas: "Padrão de engajamento identificado",
          chamadasAcao: "Estilo de apelos observado"
        },
        estruturaESiloHomiletico: {
          estiloPrincipal: "Estilo homilético identificado no material",
          introducao: "Padrão de introdução observado",
          desenvolvimentoCorpo: "Estrutura de desenvolvimento identificada",
          transicoes: "Padrão de transições observado",
          conclusao: "Estilo de conclusão identificado",
          usoIlustracoesAnalogias: "Uso de ilustrações observado"
        },
        linhaTeologicaEInterpretativa: {
          enfasesDoutrinarias: "Ênfases teológicas identificadas",
          abordagemHermeneutica: "Abordagem interpretativa observada",
          fontesAutoridade: "Fontes de autoridade identificadas",
          visaoGeral: "Perspectiva teológica geral identificada"
        },
        recursosRetoricosEDidaticos: {
          figurasLinguagem: "Recursos linguísticos observados",
          usoHumor: "Padrão de humor identificado",
          interacaoAudiencia: "Estilo de interação observado",
          didaticaEspecifica: "Métodos didáticos identificados",
          linguagemInclusiva: "Padrão de linguagem observado"
        }
      };
    }
  } catch (error) {
    console.error('Erro no processamento do DNA:', error);
    throw new Error('Falha ao processar DNA com IA');
  }
};

// RAG helper function
const retrieve_relevant_chunks = async (query_text: string, num_results: number = 3): Promise<string[]> => {
  try {
    // Use the RAG service instead of direct ChromaDB access
    const chunks = await ragService.searchSimilarChunks(query_text, num_results);
    return chunks.map(chunk => chunk.chunkText);
  } catch (error) {
    console.error('Error retrieving chunks:', error);
    return [];
  }
};

// Sermon generation function  
const generateSermonWithAI = async (request: any): Promise<any> => {
  try {
    const { theme, purpose, audience, duration, style, context, referenceUrls, dnaType, activeDnaProfile, userId } = request;

    // Read system prompt from file
    const systemPromptPath = path.join(process.cwd(), 'backend', 'prompts', 'AGENTE_GERADOR_SERMAO.txt');
    const systemPromptContent = fs.readFileSync(systemPromptPath, 'utf8');

    // Get enhanced context from RAG service
    const ragContext = await ragService.getEnhancedContext(userId, theme, `${purpose} ${audience} ${context}`.trim());

    const dnaContext = activeDnaProfile && dnaType === 'customizado' ? `
PERFIL DNA DO PREGADOR (Análise Detalhada):

### LINGUAGEM VERBAL:
- Formalidade: ${activeDnaProfile.customAttributes?.linguagemVerbal?.formalidade || 'Não especificado'}
- Vocabulário: ${activeDnaProfile.customAttributes?.linguagemVerbal?.vocabulario || 'Não especificado'}
- Palavras-chave/Frases-efeito: ${activeDnaProfile.customAttributes?.linguagemVerbal?.palavrasChaveFrasesEfeito || 'Não especificado'}
- Clareza/Precisão: ${activeDnaProfile.customAttributes?.linguagemVerbal?.clarezaPrecisao || 'Não especificado'}
- Sintaxe Frasal: ${activeDnaProfile.customAttributes?.linguagemVerbal?.sintaxeFrasal || 'Não especificado'}
- Ritmo da Fala: ${activeDnaProfile.customAttributes?.linguagemVerbal?.ritmoDaFala || 'Não especificado'}

### TOM E COMUNICAÇÃO:
- Tom Geral: ${activeDnaProfile.customAttributes?.tomEComunicacao?.tomGeral || 'Não especificado'}
- Nível de Paixão/Intensidade: ${activeDnaProfile.customAttributes?.tomEComunicacao?.nivelPaixaoIntensidade || 'Não especificado'}
- Uso de Perguntas Retóricas: ${activeDnaProfile.customAttributes?.tomEComunicacao?.usoPerguntasRetoricas || 'Não especificado'}
- Chamadas à Ação: ${activeDnaProfile.customAttributes?.tomEComunicacao?.chamadasAcao || 'Não especificado'}

### ESTRUTURA E ESTILO HOMILÉTICO:
- Estilo Principal: ${activeDnaProfile.customAttributes?.estruturaESiloHomiletico?.estiloPrincipal || 'Não especificado'}
- Introdução: ${activeDnaProfile.customAttributes?.estruturaESiloHomiletico?.introducao || 'Não especificado'}
- Desenvolvimento/Corpo: ${activeDnaProfile.customAttributes?.estruturaESiloHomiletico?.desenvolvimentoCorpo || 'Não especificado'}
- Transições: ${activeDnaProfile.customAttributes?.estruturaESiloHomiletico?.transicoes || 'Não especificado'}
- Conclusão: ${activeDnaProfile.customAttributes?.estruturaESiloHomiletico?.conclusao || 'Não especificado'}
- Uso de Ilustrações/Analogias: ${activeDnaProfile.customAttributes?.estruturaESiloHomiletico?.usoIlustracoesAnalogias || 'Não especificado'}

### LINHA TEOLÓGICA E INTERPRETATIVA:
- Ênfases Doutrinárias: ${activeDnaProfile.customAttributes?.linhaTeologicaEInterpretativa?.enfasesDoutrinarias || 'Não especificado'}
- Abordagem Hermenêutica: ${activeDnaProfile.customAttributes?.linhaTeologicaEInterpretativa?.abordagemHermeneutica || 'Não especificado'}
- Fontes de Autoridade: ${activeDnaProfile.customAttributes?.linhaTeologicaEInterpretativa?.fontesAutoridade || 'Não especificado'}
- Visão Geral: ${activeDnaProfile.customAttributes?.linhaTeologicaEInterpretativa?.visaoGeral || 'Não especificado'}

### RECURSOS RETÓRICOS E DIDÁTICOS:
- Figuras de Linguagem: ${activeDnaProfile.customAttributes?.recursosRetoricosEDidaticos?.figurasLinguagem || 'Não especificado'}
- Uso de Humor: ${activeDnaProfile.customAttributes?.recursosRetoricosEDidaticos?.usoHumor || 'Não especificado'}
- Interação com Audiência: ${activeDnaProfile.customAttributes?.recursosRetoricosEDidaticos?.interacaoAudiencia || 'Não especificado'}
- Didática Específica: ${activeDnaProfile.customAttributes?.recursosRetoricosEDidaticos?.didaticaEspecifica || 'Não especificado'}
- Linguagem Inclusiva: ${activeDnaProfile.customAttributes?.recursosRetoricosEDidaticos?.linguagemInclusiva || 'Não especificado'}

ADERÊNCIA RIGOROSA: O sermão deve incorporar TODAS as características identificadas acima, replicando fielmente o estilo único deste pregador.
` : 'PERFIL DNA: Padrão equilibrado e versátil - pastor batista bem embasado, focado no ensino bíblico com aplicação prática';

    // Prepare inference variables
    const inferredTheme = theme || 'Tema livre';
    const inferredPurpose = purpose === 'nenhum' ? 'Geral' : purpose;
    const inferredAudience = audience === 'nenhum' ? 'Congregação geral' : audience;
    const inferredDuration = duration === 'nenhum' ? '30-45 minutos' : duration;
    const inferredStyle = style === 'nenhum' ? 'Expositivo' : style;
    const inferredContext = context === 'nenhum' ? 'Culto regular' : context;
    const bibleVerses: string[] = []; // Will be populated if we implement verse extraction
    const referenceInsights = referenceUrls ? 'URLs de referência fornecidas para processamento' : 'Nenhum insight específico';
    const retrievedContext = ragContext || 'Nenhum contexto adicional recuperado dos documentos teológicos.';

    // Create user message content following the new dynamic format
    const userMessageContent = `
---
## ⚙️ Modo Operacional para ESTE SERMÃO ESPECÍFICO:

1.  **Parâmetros do Sermão (Fornecidos/Inferidos):**
    -   Tema: ${inferredTheme}
    -   Propósito: ${inferredPurpose}
    -   Público-alvo: ${inferredAudience}
    -   Duração Solicitada: ${inferredDuration} (ADAPTE O VOLUME DE CONTEÚDO, DETALHE, NÚMERO DE PONTOS E PROFUNDIDADE DE EXPLANAÇÃO PARA ATINGIR ESTA DURAÇÃO. Considere 120-150 palavras por minuto.)
    -   Estilo: ${inferredStyle}
    -   Contexto: ${inferredContext}
    -   Versículos Bíblicos Selecionados: ${bibleVerses.length > 0 ? bibleVerses.join(", ") : "Nenhum"}
    -   Insights de Sermões de Referência: ${referenceInsights}

2.  **DNA do Pregador (Perfil Completo):**
    ${dnaContext}

3.  **Contexto Adicional de Comentários Bíblicos (RAG):**
    Use este contexto, recuperado de suas fontes de referência, para aprofundar e enriquecer o sermão. **Priorize esta informação para precisão e detalhes factuais/teológicos.**
    ${retrievedContext}

---
## 📝 Formato de Resposta (JSON - ESTRICTAMENTE NESTE FORMATO):

Retorne APENAS o JSON, sem texto adicional antes ou depois.

{
  "sermao": "Texto completo do sermão gerado, **JÁ FORMATADO em LINGUAGEM NATURAL, como um post de blog**. Utilize títulos, subtítulos, parágrafos espaçados, e uso estratégico de negrito/itálico para máxima legibilidade e impacto. Exemplos de formatação: \\n\\n## Título do Sermão: A Esperança que Transforma\\n\\n### Introdução: Onde Encontramos Refúgio?\\n\\n[Primeiro parágrafo da introdução...]\\n\\n### Ponto 1: A Natureza da Verdadeira Esperança\\n\\n**Hebreus 11:1** - _'Ora, a fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.'_\\n\\n[Explanação do ponto...]\\n\\n### Conclusão: Uma Chamada à Ação Transformadora\\n\\n[Último parágrafo da conclusão...]",
  "sugestoes_enriquecimento": [
    "Sugestão 1: Descrição da ilustração/metáfora/dinâmica.",
    "Sugestão 2: Descrição da ilustração/metáfora/dinâmica."
  ],
  "avaliacao_qualidade": {
    "nota": "Número de 0 a 10, pode ser decimal (ex: 9.2)",
    "justificativa": "Breve texto com pontos fortes e sugestões de melhoria."
  }
}`;

    // Create messages for Gemini
    const messagesForGemini = [
      { "role": "system", "parts": [{ "text": systemPromptContent }] },
      { "role": "user", "parts": [{ "text": userMessageContent }] }
    ];

    const response = await callGeminiChatModel(messagesForGemini, true);

    // Clean and parse the response
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Find JSON content between first { and last }
    const firstBrace = cleanedResponse.indexOf('{');
    const lastBrace = cleanedResponse.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsedResponse = JSON.parse(cleanedResponse);
      
      // Validate that the response has the expected structure
      if (!parsedResponse.sermao) {
        throw new Error('Resposta inválida: campo "sermao" não encontrado');
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error('Erro ao processar resposta do sermão:', parseError);
      console.error('Resposta original:', response);
      console.error('Resposta limpa:', cleanedResponse);

      // Try to extract sermon content manually if JSON parsing fails
      const sermonMatch = response.match(/"sermao":\s*"([^"]*(?:\\.[^"]*)*)"/);
      if (sermonMatch) {
        const extractedSermon = sermonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        return {
          sermao: extractedSermon,
          sugestoes_enriquecimento: [
            "Incluir testemunhos pessoais relevantes ao tema",
            "Adicionar ilustrações visuais ou objetos para demonstração",
            "Promover momentos de oração e reflexão pessoal"
          ],
          avaliacao_qualidade: {
            nota: 7.0,
            justificativa: "Sermão extraído com sucesso, mas com formato parcialmente recuperado."
          }
        };
      }

      // Final fallback response
      return {
        sermao: "## Sermão Gerado\n\nDevido a problemas técnicos, o sermão não pôde ser gerado completamente. Por favor, tente novamente.",
        sugestoes_enriquecimento: [
          "Incluir testemunhos pessoais relevantes ao tema",
          "Adicionar ilustrações visuais ou objetos para demonstração",
          "Promover momentos de oração e reflexão pessoal"
        ],
        avaliacao_qualidade: {
          nota: 5.0,
          justificativa: "Sermão incompleto devido a erro técnico. Recomenda-se gerar novamente."
        }
      };
    }
  } catch (error) {
    console.error('Erro na geração do sermão:', error);
    throw new Error('Falha ao gerar sermão com IA');
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // Validate password requirements
      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ message: 'A senha deve conter pelo menos um número' });
      }

      if (!/[^a-zA-Z0-9]/.test(password)) {
        return res.status(400).json({ message: 'A senha deve conter pelo menos um caractere especial' });
      }

      // Validate other fields
      if (!email || !name) {
        return res.status(400).json({ message: 'Email e nome são obrigatórios' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Usuário já existe com este email' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
      });

      // Generate token
      const token = generateToken(user.id);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          activeDnaProfileId: user.activeDnaProfileId,
        },
        token,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Falha ao criar usuário' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Check password
      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Generate token
      const token = generateToken(user.id);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          activeDnaProfileId: user.activeDnaProfileId,
        },
        token,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(400).json({ message: error.message || 'Falha no login' });
    }
  });

  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
  });

  app.post('/api/auth/reset-password/request', async (req, res) => {
    try {
      const { email } = passwordResetRequestSchema.parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: 'Se uma conta com este email existir, um link de redefinição foi enviado.' });
      }

      // Generate reset token
      const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      console.log(`Token de redefinição de senha para ${email}: ${resetToken}`);

      res.json({ message: 'Se uma conta com este email existir, um link de redefinição foi enviado.' });
    } catch (error: any) {
      console.error('Erro na solicitação de redefinição de senha:', error);
      res.status(400).json({ message: error.message || 'Falha ao processar solicitação de redefinição de senha' });
    }
  });

  app.post('/api/auth/reset-password/confirm', async (req, res) => {
    try {
      const { token, password } = passwordResetConfirmSchema.parse(req.body);

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: 'Token de redefinição inválido ou expirado' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });

      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ message: 'Senha redefinida com sucesso' });
    } catch (error: any) {
      console.error('Erro na confirmação de redefinição de senha:', error);
      res.status(400).json({ message: error.message || 'Falha ao redefinir senha' });
    }
  });

  // Protected routes
  app.get('/api/auth/user', authenticateToken, (req: AuthRequest, res) => {
    const user = { ...req.user };
    delete user.password;
    res.json(user);
  });

  app.get('/api/user/me', authenticateToken, (req: AuthRequest, res) => {
    const user = req.user!;
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      activeDnaProfileId: user.activeDnaProfileId,
    });
  });

  app.get('/api/user/dna', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const dnaProfiles = await storage.getDnaProfilesByUserId(userId);
      const activeDnaProfile = await storage.getActiveDnaProfile(userId);

      res.json({
        profiles: dnaProfiles,
        activeProfile: activeDnaProfile,
        hasCustomDNA: dnaProfiles.some(profile => profile.type === "customizado"),
      });
    } catch (error: any) {
      console.error('Erro ao buscar DNA:', error);
      res.status(500).json({ message: 'Falha ao recuperar perfis de DNA' });
    }
  });

  app.post('/api/user/dna', authenticateToken, upload.array('files', 5), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[] || [];

      // Parse JSON fields from form data
      const pastedTexts = req.body.pastedTexts ? JSON.parse(req.body.pastedTexts) : [];
      const youtubeLinks = req.body.youtubeLinks ? JSON.parse(req.body.youtubeLinks) : [];
      const personalDescription = req.body.personalDescription || '';

      // Process DNA with AI
      const customAttributes = await processDNA(userId, files, pastedTexts, youtubeLinks, personalDescription);

      // Handle DNA profile creation/update
      const existingProfiles = await storage.getDnaProfilesByUserId(userId);
      const existingCustomProfile = existingProfiles.find(profile => profile.type === "customizado");

      let dnaProfile;
      if (existingCustomProfile) {
        // Update existing profile
        dnaProfile = await storage.updateDnaProfile(existingCustomProfile.id, {
          customAttributes,
          uploadedFiles: files.map(f => ({ name: f.originalname, type: f.mimetype, size: f.size })),
          content: JSON.stringify({ pastedTexts, youtubeLinks, personalDescription }),
        });
      } else {
        // Create new profile
        dnaProfile = await storage.createDnaProfile({
          userId,
          type: "customizado",
          customAttributes,
          uploadedFiles: files.map(f => ({ name: f.originalname, type: f.mimetype, size: f.size })),
          content: JSON.stringify({ pastedTexts, youtubeLinks, personalDescription }),
        });
      }

      // Set active DNA profile
      await storage.updateUser(userId, { activeDnaProfileId: dnaProfile!.id });

      res.json({
        message: 'Perfil de DNA criado/atualizado com sucesso',
        dnaProfile,
      });
    } catch (error: any) {
      console.error('Erro na geração de DNA:', error);
      res.status(500).json({ message: 'Erro ao processar o DNA: ' + error.message });
    }
  });

  app.post('/api/user/dna/set-active', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { profileId } = req.body;

      // Verify profile belongs to user
      const profile = await storage.getDnaProfile(profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ message: 'Perfil de DNA não encontrado' });
      }

      // Update user's active DNA profile
      await storage.updateUser(userId, { activeDnaProfileId: profileId });

      res.json({ message: 'Perfil de DNA ativo atualizado com sucesso' });
    } catch (error: any) {
      console.error('Erro ao definir DNA ativo:', error);
      res.status(500).json({ message: 'Falha ao atualizar perfil de DNA ativo' });
    }
  });

  // DNA Profile Routes
  app.get('/api/dna-profiles', authenticateToken, async (req, res) => {
    try {
      const userId = req.user!.id;
      const profiles = await storage.getDnaProfilesByUserId(userId);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Erro ao buscar perfis DNA' });
    }
  });

  app.post('/api/sermon/generate', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const validatedData = generateSermonSchema.parse(req.body);

      // Additional server-side validation for required fields
      if (!validatedData.theme || validatedData.theme.trim() === '') {
        return res.status(400).json({ message: 'Tema do sermão é obrigatório' });
      }

      if (!validatedData.duration || validatedData.duration === 'nenhum' || validatedData.duration.trim() === '') {
        return res.status(400).json({ message: 'Duração do sermão é obrigatória' });
      }

      // Get active DNA profile
      const activeDnaProfile = await storage.getActiveDnaProfile(userId);

      // Generate sermon with AI
      const sermonContent = await generateSermonWithAI({
        ...validatedData,
        activeDnaProfile,
      });

      // Check current sermon count and maintain limit of 5
      const existingSermons = await storage.getSermonsByUserId(userId);

      // If user has 5 or more sermons, delete the oldest ones
      if (existingSermons.length >= 5) {
        const sermonsToDelete = existingSermons
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateA - dateB;
          })
          .slice(0, existingSermons.length - 4); // Keep 4, delete the rest

        for (const sermonToDelete of sermonsToDelete) {
          await storage.deleteSermon(sermonToDelete.id);
        }
      }

      // Save sermon to database
      const sermon = await storage.createSermon({
        userId,
        title: validatedData.theme || 'Sermão Gerado',
        content: JSON.stringify(sermonContent),
        dnaProfileId: activeDnaProfile?.id || null,
      });

      res.json({
        message: 'Sermão gerado com sucesso',
        sermon,
        sermonContent,
        sermonId: sermon.id
      });
    } catch (error: any) {
      console.error('Erro na geração do sermão:', error);
      res.status(500).json({ message: 'Falha ao gerar sermão: ' + error.message });
    }
  });

  app.get('/api/sermons', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const sermons = await storage.getSermonsByUserId(userId);
      res.json(sermons);
    } catch (error: any) {
      console.error('Erro ao buscar sermões:', error);
      res.status(500).json({ message: 'Falha ao recuperar sermões' });
    }
  });

  app.get('/api/sermons/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const sermonId = parseInt(req.params.id);

      const sermon = await storage.getSermon(sermonId);
      if (!sermon || sermon.userId !== userId) {
        return res.status(404).json({ message: 'Sermão não encontrado' });
      }

      res.json(sermon);
    } catch (error: any) {
      console.error('Erro ao buscar sermão:', error);
      res.status(500).json({ message: 'Falha ao recuperar sermão' });
    }
  });

  app.patch('/api/sermons/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const sermonId = parseInt(req.params.id);
      const { title, content } = req.body;

      // Verify sermon ownership
      const existingSermon = await storage.getSermon(sermonId);
      if (!existingSermon || existingSermon.userId !== userId) {
        return res.status(404).json({ message: 'Sermão não encontrado' });
      }

      // Update sermon
      const updatedSermon = await storage.updateSermon(sermonId, {
        title: title || existingSermon.title,
        content: content || existingSermon.content,
      });

      if (!updatedSermon) {
        return res.status(500).json({ message: 'Falha ao atualizar sermão' });
      }

      res.json(updatedSermon);
    } catch (error: any) {
      console.error('Erro ao atualizar sermão:', error);
      res.status(500).json({ message: 'Falha ao atualizar sermão' });
    }
  });

  app.delete('/api/sermons/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const sermonId = parseInt(req.params.id);

      // Verify sermon ownership
      const existingSermon = await storage.getSermon(sermonId);
      if (!existingSermon || existingSermon.userId !== userId) {
        return res.status(404).json({ message: 'Sermão não encontrado' });
      }

      // Delete sermon
      await storage.deleteSermon(sermonId);

      res.json({ message: 'Sermão excluído com sucesso' });
    } catch (error: any) {
      console.error('Erro ao excluir sermão:', error);
      res.status(500).json({ message: 'Falha ao excluir sermão' });
    }
  });

  // RAG document upload route
  app.post('/api/rag/upload', authenticateToken, upload.array('documents', 10), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[] || [];
      
      if (files.length === 0) {
        return res.status(400).json({ message: 'Nenhum documento foi enviado' });
      }

      let documentsProcessed = 0;
      const errors: string[] = [];

      for (const file of files) {
        try {
          const documentId = `doc_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const text = file.buffer.toString('utf-8');
          
          // Store document in RAG service
          await ragService.storeDocument(userId, documentId, text, file.originalname);
          documentsProcessed++;
        } catch (error: any) {
          errors.push(`Erro ao processar ${file.originalname}: ${error.message}`);
        }
      }

      const stats = await ragService.getUserDocumentStats(userId);
      
      res.json({
        message: `${documentsProcessed} documento(s) processado(s) com sucesso`,
        documentsProcessed,
        errors: errors.length > 0 ? errors : undefined,
        stats
      });
    } catch (error: any) {
      console.error('Erro no upload de documentos RAG:', error);
      res.status(500).json({ message: 'Falha ao processar documentos' });
    }
  });

  // RAG document statistics route
  app.get('/api/rag/stats', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const stats = await ragService.getUserDocumentStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas RAG:', error);
      res.status(500).json({ message: 'Falha ao recuperar estatísticas' });
    }
  });

  // Clear RAG documents route
  app.delete('/api/rag/documents', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      await ragService.clearUserDocuments(userId);
      res.json({ message: 'Documentos removidos com sucesso' });
    } catch (error: any) {
      console.error('Erro ao remover documentos RAG:', error);
      res.status(500).json({ message: 'Falha ao remover documentos' });
    }
  });

  // Admin authentication middleware
  const isAdmin = async (req: AuthRequest, res: any, next: any) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (user.role !== 'admin' || !user.isActive) {
        return res.status(403).json({ message: "Access denied - Admin role required" });
      }

      next();
    } catch (error) {
      console.error('Admin auth error:', error);
      res.status(500).json({ message: "Authentication error" });
    }
  };

  // Admin Dashboard - Get statistics
  app.get('/api/admin/dashboard', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      // Get user statistics
      const totalUsers = await db.select({ count: sql`count(*)` }).from(users);
      const activeUsers = await db.select({ count: sql`count(*)` })
        .from(users)
        .where(sql`${users.createdAt} >= NOW() - INTERVAL '30 days'`);
      
      // Get sermon statistics  
      const totalSermons = await db.select({ count: sql`count(*)` }).from(sermons);
      const recentSermons = await db.select()
        .from(sermons)
        .orderBy(sql`${sermons.createdAt} DESC`)
        .limit(10);

      // Get DNA usage stats
      const customDnaCount = await db.select({ count: sql`count(*)` })
        .from(dnaProfiles)
        .where(eq(dnaProfiles.type, "customizado"));
      
      const totalDnaProfiles = await db.select({ count: sql`count(*)` }).from(dnaProfiles);

      // Get RAG statistics
      const ragStats = await ragService.getUserDocumentStats(0); // Global stats (0 for admin view)

      res.json({
        users: {
          total: totalUsers[0]?.count || 0,
          active: activeUsers[0]?.count || 0
        },
        sermons: {
          total: totalSermons[0]?.count || 0,
          recent: recentSermons
        },
        dna: {
          custom: customDnaCount[0]?.count || 0,
          total: totalDnaProfiles[0]?.count || 0
        },
        rag: ragStats
      });
    } catch (error: any) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ message: 'Falha ao buscar estatísticas' });
    }
  });

  // Admin Users Management - List all users
  app.get('/api/admin/users', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(sql`${users.createdAt} DESC`);
      res.json(allUsers);
    } catch (error: any) {
      console.error('Admin users list error:', error);
      res.status(500).json({ message: 'Falha ao buscar usuários' });
    }
  });

  // Admin Users Management - Get user details with DNA
  app.get('/api/admin/users/:id', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      const dnaProfiles = await storage.getDnaProfilesByUserId(userId);
      const userSermons = await storage.getSermonsByUserId(userId);

      res.json({
        user,
        dnaProfiles,
        sermons: userSermons.slice(0, 10) // últimos 10 sermões
      });
    } catch (error: any) {
      console.error('Admin user details error:', error);
      res.status(500).json({ message: 'Falha ao buscar detalhes do usuário' });
    }
  });

  // Admin Users Management - Update user status
  app.patch('/api/admin/users/:id/status', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      const updatedUser = await storage.updateUser(userId, { isActive });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      res.json({
        message: `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso`,
        user: updatedUser
      });
    } catch (error: any) {
      console.error('Admin user status update error:', error);
      res.status(500).json({ message: 'Falha ao atualizar status do usuário' });
    }
  });

  // Admin Users Management - Delete user
  app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Delete user (cascade will handle related data)
      await db.delete(users).where(eq(users.id, userId));

      res.json({ message: 'Usuário deletado com sucesso' });
    } catch (error: any) {
      console.error('Admin user delete error:', error);
      res.status(500).json({ message: 'Falha ao deletar usuário' });
    }
  });

  // Admin RAG Management - List RAG documents
  app.get('/api/admin/rag/documents', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const documents = await db.select().from(ragChunks)
        .orderBy(sql`${ragChunks.createdAt} DESC`);
      
      // Group by document_id
      const groupedDocs = documents.reduce((acc: any, chunk) => {
        if (!acc[chunk.documentId]) {
          acc[chunk.documentId] = {
            documentId: chunk.documentId,
            sourceUrl: chunk.sourceUrl,
            userId: chunk.userId,
            chunkCount: 0,
            createdAt: chunk.createdAt
          };
        }
        acc[chunk.documentId].chunkCount++;
        return acc;
      }, {});

      res.json(Object.values(groupedDocs));
    } catch (error: any) {
      console.error('Admin RAG documents error:', error);
      res.status(500).json({ message: 'Falha ao buscar documentos RAG' });
    }
  });

  // Admin RAG Management - Delete RAG document
  app.delete('/api/admin/rag/documents/:documentId', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const documentId = req.params.documentId;
      
      await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));
      
      res.json({ message: 'Documento RAG removido com sucesso' });
    } catch (error: any) {
      console.error('Admin RAG delete error:', error);
      res.status(500).json({ message: 'Falha ao remover documento RAG' });
    }
  });

  // Admin RAG Management - Bulk index documents
  app.post('/api/admin/rag/bulk-index', authenticateToken, isAdmin, upload.array('documents', 20), async (req: AuthRequest, res: any) => {
    try {
      console.log('[BulkIndex] Starting bulk index process...');
      console.log('[BulkIndex] Request headers:', {
        authorization: req.headers.authorization ? `${req.headers.authorization.substring(0, 20)}...` : 'missing',
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length']
      });
      console.log('[BulkIndex] User info:', {
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role
      });

      const files = req.files as Express.Multer.File[] || [];
      const adminUserId = req.user!.id;
      
      console.log(`[BulkIndex] Received ${files.length} files for bulk indexing from user ${adminUserId}`);
      
      if (files.length === 0) {
        console.log('[BulkIndex] No files received in request');
        return res.status(400).json({ message: 'Nenhum arquivo foi enviado' });
      }

      const results = [];

      for (const file of files) {
        console.log(`[BulkIndex] Processing file: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
        try {
          // Validate file type
          const allowedTypes = ['.txt', '.pdf', '.docx', '.md'];
          const fileExt = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
          
          console.log(`[BulkIndex] File extension detected: ${fileExt}`);
          
          if (!allowedTypes.includes(fileExt)) {
            console.log(`[BulkIndex] File type not supported: ${fileExt}`);
            results.push({
              success: false,
              fileName: file.originalname,
              message: `Tipo de arquivo não suportado: ${fileExt}`
            });
            continue;
          }

          // Extract text content based on file type
          let fileContent: string;
          
          if (fileExt === '.txt' || fileExt === '.md') {
            fileContent = file.buffer.toString('utf-8');
          } else if (fileExt === '.pdf') {
            // For now, treat PDF as text (you can add PDF parsing library later)
            fileContent = file.buffer.toString('utf-8');
          } else if (fileExt === '.docx') {
            // For now, treat DOCX as text (you can add DOCX parsing library later)
            fileContent = file.buffer.toString('utf-8');
          } else {
            fileContent = file.buffer.toString('utf-8');
          }

          // Validate content
          if (!fileContent.trim() || fileContent.trim().length < 50) {
            results.push({
              success: false,
              fileName: file.originalname,
              message: 'Conteúdo do arquivo muito pequeno ou vazio'
            });
            continue;
          }

          const documentId = `admin_bulk_${file.originalname.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
          
          console.log(`[BulkIndex] Storing document: ${documentId} (${fileContent.trim().length} characters)`);
          await ragService.storeDocument(
            adminUserId, 
            documentId, 
            fileContent.trim(), 
            `bulk-upload:${file.originalname}`
          );

          console.log(`[BulkIndex] Successfully indexed: ${file.originalname}`);
          results.push({
            success: true,
            fileName: file.originalname,
            message: 'Indexado com sucesso'
          });

        } catch (fileError: any) {
          console.error(`[BulkIndex] Error processing file ${file.originalname}:`, {
            error: fileError.message,
            stack: fileError.stack?.substring(0, 200)
          });
          results.push({
            success: false,
            fileName: file.originalname,
            message: fileError.message || 'Erro durante indexação'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[BulkIndex] Bulk indexing completed. Successful: ${successCount}/${results.length}`);

      res.json({
        message: 'Processamento de lote concluído',
        results,
        processed: results.length,
        successful: successCount
      });

    } catch (error: any) {
      console.error('[BulkIndex] Admin bulk index error:', {
        error: error.message,
        stack: error.stack?.substring(0, 300),
        userId: req.user?.id
      });
      res.status(500).json({ message: 'Falha no processamento em lote', error: error.message });
    }
  });

  // Admin Reports - Get system reports
  app.get('/api/admin/reports', authenticateToken, isAdmin, async (req: AuthRequest, res) => {
    try {
      const period = req.query.period as string || 'month';
      
      // Calculate date range based on period
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default: // month
          startDate.setMonth(now.getMonth() - 1);
      }

      // Users statistics
      const totalUsers = await db.select({ count: sql`count(*)` }).from(users);
      const activeUsers = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.isActive, true));
      const inactiveUsers = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.isActive, false));
      const adminUsers = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, 'admin'));
      const newUsers = await db.select({ count: sql`count(*)` }).from(users)
        .where(sql`${users.createdAt} >= ${startDate}`);

      // Sermons statistics
      const totalSermons = await db.select({ count: sql`count(*)` }).from(sermons);
      const recentSermons = await db.select({ count: sql`count(*)` }).from(sermons)
        .where(sql`${sermons.createdAt} >= ${startDate}`);
      
      const avgSermonsPerUser = totalUsers[0]?.count > 0 
        ? (totalSermons[0]?.count || 0) / (totalUsers[0]?.count || 1) 
        : 0;

      // Top themes (simplified - would need proper theme extraction)
      const topThemes = [
        { theme: "Amor de Deus", count: 5 },
        { theme: "Fé e Esperança", count: 4 },
        { theme: "Salvação", count: 3 }
      ];

      // DNA profiles statistics
      const totalDnaProfiles = await db.select({ count: sql`count(*)` }).from(dnaProfiles);
      const customDnaProfiles = await db.select({ count: sql`count(*)` }).from(dnaProfiles)
        .where(eq(dnaProfiles.type, 'custom'));
      const defaultDnaProfiles = await db.select({ count: sql`count(*)` }).from(dnaProfiles)
        .where(eq(dnaProfiles.type, 'default'));
      
      const avgProfilesPerUser = totalUsers[0]?.count > 0 
        ? (totalDnaProfiles[0]?.count || 0) / (totalUsers[0]?.count || 1) 
        : 0;

      // RAG statistics
      const totalRagDocs = await db.select({ 
        count: sql`count(distinct ${ragChunks.documentId})` 
      }).from(ragChunks);
      const totalRagChunks = await db.select({ count: sql`count(*)` }).from(ragChunks);
      
      const avgChunksPerDoc = totalRagDocs[0]?.count > 0 
        ? (totalRagChunks[0]?.count || 0) / (totalRagDocs[0]?.count || 1) 
        : 0;

      // Top users by sermon count
      const topUsers = await db.select({
        userId: users.id,
        userName: users.name,
        sermonCount: sql`count(${sermons.id})`
      })
      .from(users)
      .leftJoin(sermons, eq(users.id, sermons.userId))
      .groupBy(users.id, users.name)
      .orderBy(sql`count(${sermons.id}) desc`)
      .limit(5);

      const report = {
        users: {
          total: parseInt(totalUsers[0]?.count) || 0,
          active: parseInt(activeUsers[0]?.count) || 0,
          inactive: parseInt(inactiveUsers[0]?.count) || 0,
          admins: parseInt(adminUsers[0]?.count) || 0,
          newThisMonth: parseInt(newUsers[0]?.count) || 0
        },
        sermons: {
          total: parseInt(totalSermons[0]?.count) || 0,
          thisMonth: parseInt(recentSermons[0]?.count) || 0,
          avgPerUser: parseFloat(avgSermonsPerUser.toFixed(1)),
          topThemes
        },
        dna: {
          totalProfiles: parseInt(totalDnaProfiles[0]?.count) || 0,
          customProfiles: parseInt(customDnaProfiles[0]?.count) || 0,
          defaultProfiles: parseInt(defaultDnaProfiles[0]?.count) || 0,
          avgProfilesPerUser: parseFloat(avgProfilesPerUser.toFixed(1))
        },
        rag: {
          totalDocuments: parseInt(totalRagDocs[0]?.count) || 0,
          totalChunks: parseInt(totalRagChunks[0]?.count) || 0,
          avgChunksPerDoc: parseFloat(avgChunksPerDoc.toFixed(1)),
          documentsByUser: [] // Could be implemented if needed
        },
        usage: {
          peakHours: [], // Would need request logging to implement
          topUsers: topUsers.map(u => ({
            userId: u.userId,
            userName: u.userName || 'Unknown',
            sermonCount: parseInt(u.sermonCount) || 0
          }))
        }
      };

      res.json(report);

    } catch (error: any) {
      console.error('Admin reports error:', error);
      res.status(500).json({ message: 'Falha ao gerar relatórios' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
