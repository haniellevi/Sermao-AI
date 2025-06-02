import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
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

  if (!token) {
    return res.status(401).json({ message: 'Token de acesso necessário' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido ou expirado' });
  }
};

// Helper functions
const generateToken = (userId: number): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// AI helper function
const callGemini = async (prompt: string, isLongForm = false): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: isLongForm ? "gemini-1.5-pro" : "gemini-1.5-flash" 
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini AI error:', error);
    
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
    // Create analysis prompt
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
        teologia: "Teologia bíblica equilibrada com ênfase na aplicação prática",
        estilo: "Pregação expositiva com ilustrações contemporâneas",
        audiencia: "Congregação geral com diversidade de idades e experiências",
        linguagem: "Linguagem acessível e envolvente",
        estrutura: "Estrutura clara com introdução, desenvolvimento e conclusão"
      };
    }

    const dnaPrompt = `
Você é um Agente Especialista em Análise de Estilo Homilético e Teológico com a função crítica de criar um perfil DNA de pregação personalizado.

CONTEÚDO PARA ANÁLISE:
${contentForAnalysis}

TAREFA: Analise profundamente o conteúdo fornecido e crie um perfil DNA detalhado nas seguintes categorias:

1. TEOLOGIA E DOUTRINA:
- Linha teológica predominante
- Ênfases doutrinárias específicas
- Abordagem hermenêutica
- Visão de aplicação bíblica

2. ESTILO HOMILÉTICO:
- Tipo de pregação (expositiva, temática, textual)
- Uso de ilustrações e analogias
- Ritmo e dinâmica da pregação
- Elementos retóricos característicos

3. PERFIL DA AUDIÊNCIA:
- Tipo de congregação alvo
- Nível de maturidade espiritual presumido
- Contexto cultural e social
- Necessidades pastorais identificadas

4. LINGUAGEM E COMUNICAÇÃO:
- Registro linguístico (formal, informal, coloquial)
- Uso de termos técnicos teológicos
- Clareza e acessibilidade
- Elementos de persuasão

5. ESTRUTURA E ORGANIZAÇÃO:
- Padrão de organização de conteúdo
- Uso de esquemas e divisões
- Transições entre pontos
- Conclusões e apelos característicos

FORMATO DE RESPOSTA: Retorne APENAS um objeto JSON válido com as chaves: teologia, estilo, audiencia, linguagem, estrutura. Cada valor deve ser uma string descritiva de 1-2 frases.

Seja preciso, objetivo e baseie-se exclusivamente no conteúdo analisado.
`;

    const dnaResponse = await callGemini(dnaPrompt);
    
    try {
      // Clean the response to remove markdown formatting
      let cleanedResponse = dnaResponse.trim();
      
      // Remove markdown code block markers
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Erro ao processar resposta da IA:', parseError);
      console.error('Resposta original da IA:', dnaResponse);
      return {
        teologia: "Análise teológica baseada no conteúdo fornecido",
        estilo: "Estilo homilético identificado no material",
        audiencia: "Perfil de audiência inferido do conteúdo",
        linguagem: "Padrão linguístico observado",
        estrutura: "Estrutura organizacional característica"
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

    const dnaContext = activeDnaProfile && dnaType === 'customizado' ? `
PERFIL DNA DO PREGADOR:
- Teologia: ${activeDnaProfile.customAttributes?.teologia || 'Não especificado'}
- Estilo: ${activeDnaProfile.customAttributes?.estilo || 'Não especificado'}  
- Audiência: ${activeDnaProfile.customAttributes?.audiencia || 'Não especificado'}
- Linguagem: ${activeDnaProfile.customAttributes?.linguagem || 'Não especificado'}
- Estrutura: ${activeDnaProfile.customAttributes?.estrutura || 'Não especificado'}
` : 'PERFIL DNA: Padrão equilibrado e versátil';

    const sermonPrompt = `
Você é um Agente Homilético Profissional especializado em criação de sermões personalizados de alta qualidade pastoral.

${dnaContext}

DADOS DO SERMÃO:
- Tema: ${theme || 'Tema livre'}
- Propósito: ${purpose === 'nenhum' ? 'Geral' : purpose}
- Audiência: ${audience === 'nenhum' ? 'Congregação geral' : audience}
- Duração: ${duration === 'nenhum' ? '30-45 minutos' : duration}
- Estilo: ${style === 'nenhum' ? 'Expositivo' : style}
- Contexto: ${context === 'nenhum' ? 'Culto regular' : context}
- URLs de Referência: ${referenceUrls || 'Nenhuma'}

IMPORTANTE: Você DEVE retornar APENAS um JSON válido no seguinte formato exato:

{
  "sermao": "Texto completo do sermão gerado, **JÁ FORMATADO** com títulos, subtítulos, parágrafos espaçados, e uso de negrito/itálico estratégico para máxima legibilidade e impacto. Use formatação Markdown: \\n\\n## Título do Sermão\\n\\n### Introdução\\n\\n[Conteúdo...]\\n\\n### Ponto 1: Título do Ponto\\n\\n**Versículo** - _'Texto bíblico'_\\n\\n[Explanação...]\\n\\n### Conclusão\\n\\n[Conclusão...]",
  "sugestoes_enriquecimento": [
    "Sugestão 1: Ilustração ou dinâmica específica para engajar a audiência",
    "Sugestão 2: Metáfora ou exemplo prático para tornar o ensino mais claro",
    "Sugestão 3: Atividade interativa ou momento de reflexão"
  ],
  "avaliacao_qualidade": {
    "nota": 9.2,
    "justificativa": "Pontos fortes: fidelidade bíblica, clareza na estrutura, aplicação prática relevante. Sugestões: mais ilustrações contemporâneas, maior interação com a audiência."
  }
}

ESTRUTURA DO SERMÃO:
1. TÍTULO IMPACTANTE
2. TEXTO BÍBLICO PRINCIPAL
3. INTRODUÇÃO ENVOLVENTE
4. DESENVOLVIMENTO (3-4 pontos principais)
5. ILUSTRAÇÕES RELEVANTES
6. APLICAÇÕES PRÁTICAS
7. CONCLUSÃO PERSUASIVA
8. ORAÇÃO FINAL

Retorne APENAS o JSON, sem texto adicional antes ou depois.`;

    const response = await callGemini(sermonPrompt, true);
    
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

  const httpServer = createServer(app);
  return httpServer;
}