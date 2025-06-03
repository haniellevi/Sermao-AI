
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
} from "@shared/schema";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
}

const authenticateToken = async (req: AuthRequest, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Authentication attempt:', {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    method: req.method,
    url: req.url
  });

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Token de acesso necessário' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    console.log('Token decoded successfully:', { userId: decoded.userId });

    const user = await storage.getUser(decoded.userId);

    if (!user) {
      console.log('User not found for ID:', decoded.userId);
      return res.status(401).json({ message: 'Token inválido' });
    }

    console.log('Authentication successful for user:', user.email);
    req.user = user;
    next();
  } catch (error: any) {
    console.log('Token validation error:', {
      name: error.name,
      message: error.message,
      tokenPreview: token.substring(0, 20) + '...'
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

    // Add YouTube links
    if (youtubeLinks.length > 0) {
      contentForAnalysis += 'LINKS DO YOUTUBE:\n' + youtubeLinks.join('\n') + '\n\n';
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

// Sermon generation function  
const generateSermonWithAI = async (request: any): Promise<any> => {
  try {
    const { theme, purpose, audience, duration, style, context, referenceUrls, dnaType, activeDnaProfile } = request;

    // Read system prompt from file
    const systemPromptPath = path.join(process.cwd(), 'backend', 'prompts', 'AGENTE_GERADOR_SERMAO.txt');
    const systemPromptContent = fs.readFileSync(systemPromptPath, 'utf8');

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

    // Create user message content with detailed instructions
    const userMessageContent = `
Modo de Operação Detalhado para ESTE SERMÃO:
Com base no DNA do Pregador, e nos parâmetros abaixo, gere um sermão completo.

Duração do Sermão (DIRETIVA CRÍTICA): ADAPTE O VOLUME DE CONTEÚDO, DETALHE E PROFUNDIDADE PARA ATINGIR A DURAÇÃO EXATA SOLICITADA.

Para sermões mais curtos (10-15 minutos): Seja conciso, direto ao ponto. Foque em 2-3 pontos principais bem desenvolvidos, com aplicações e ilustrações mais breves. Priorize a mensagem central sem digressões excessivas. A introdução e a conclusão devem ser mais objetivas.

Para sermões de duração média (30-45 minutos): Desenvolva 3-4 pontos principais com profundidade adequada. Expanda a exegese, traga mais aplicações práticas e exemplos. As ilustrações podem ser mais elaboradas. As transições devem ser suaves e aprofundadas.

Para sermões mais longos (60 minutos): Desenvolva 4-5 pontos principais com grande profundidade. Inclua mais detalhes teológicos, históricos e contextuais. Explore subpontos dentro de cada ponto principal. Use ilustrações mais complexas ou múltiplas. A explanação da aplicação pode ser mais extensa e variada. Pode incluir momentos para reflexão ou perguntas retóricas mais longas que "preenchem" o tempo de entrega. A introdução pode ser mais elaborada para captar a atenção e contextualizar amplamente.

DADOS DE ENTRADA ESPECÍFICOS PARA ESTE SERMÃO:
Tema: ${theme || 'Tema livre'}
Propósito: ${purpose === 'nenhum' ? 'Geral' : purpose}
Público-alvo: ${audience === 'nenhum' ? 'Congregação geral' : audience}
Duração: ${duration === 'nenhum' ? '30-45 minutos' : duration}
Estilo: ${style === 'nenhum' ? 'Expositivo' : style}
Contexto: ${context === 'nenhum' ? 'Culto regular' : context}
URLs de Referência: ${referenceUrls || 'Nenhuma'}

DNA DO PREGADOR (Perfil Completo):
${dnaContext}

Formato de Resposta (JSON - ESTRITAMENTE NESTE FORMATO):
Retorne APENAS o JSON, sem texto adicional antes ou depois.

{
  "sermao": "Texto completo do sermão gerado, JÁ FORMATADO em LINGUAGEM NATURAL, como um post de blog. Utilize títulos, subtítulos, parágrafos espaçados, e uso estratégico de negrito/itálico para máxima legibilidade e impacto. Exemplos de formatação: \\n\\n## Título do Sermão: A Esperança que Transforma\\n\\n### Introdução: Onde Encontramos Refúgio?\\n\\n[Primeiro parágrafo da introdução...]\\n\\n### Ponto 1: A Natureza da Verdadeira Esperança\\n\\n**Hebreus 11:1** - _'Ora, a fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.'_\\n\\n[Explanação do ponto...]\\n\\n### Conclusão: Uma Chamada à Ação Transformadora\\n\\n[Último parágrafo da conclusão...]",
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
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Erro ao processar resposta do sermão:', parseError);
      console.error('Resposta original:', response);

      // Fallback response
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

  const httpServer = createServer(app);
  return httpServer;
}
