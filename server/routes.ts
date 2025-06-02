import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
// PDF parsing will be handled by converting to text format
import mammoth from "mammoth";
import { storage } from "./storage";
import { 
  loginSchema, 
  insertUserSchema, 
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  generateSermonSchema,
  createDnaSchema,
  type User 
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
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
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
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

// AI Service functions
const callGemini = async (prompt: string, format_response_as_json = false): Promise<any> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const fullPrompt = format_response_as_json 
      ? `${prompt}\n\nResponda APENAS com um JSON válido, sem texto adicional.`
      : prompt;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    if (format_response_as_json) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
        throw new Error('Invalid JSON response from AI');
      }
    }

    return text;
  } catch (error) {
    console.error('Gemini AI error:', error);
    throw new Error('Failed to generate content with AI');
  }
};

const processFileContent = async (file: Express.Multer.File): Promise<string> => {
  try {
    if (file.mimetype === 'application/pdf') {
      // For PDF files, request user to convert to text format
      return `[PDF File: ${file.originalname}] - Please convert this PDF to text format and paste the content directly in the text areas below for better analysis.`;
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } else if (file.mimetype === 'text/plain') {
      return file.buffer.toString('utf-8');
    }
    return '';
  } catch (error) {
    console.error('File processing error:', error);
    return '';
  }
};

const processDNA = async (userId: number, files: Express.Multer.File[], pastedTexts: string[], youtubeLinks: string[]): Promise<any> => {
  let allContent = '';
  
  // Process uploaded files
  if (files && files.length > 0) {
    const fileContents = await Promise.all(files.map(processFileContent));
    allContent += fileContents.join('\n\n');
  }
  
  // Add pasted texts
  if (pastedTexts && pastedTexts.length > 0) {
    allContent += '\n\n' + pastedTexts.filter(text => text.trim()).join('\n\n');
  }

  // If no content provided, create a basic DNA profile based on standard pastoral characteristics
  if (!allContent.trim()) {
    return {
      linguagemVerbal: {
        formalidade: "Linguagem equilibrada entre formal e acessível, adequada ao público congregacional",
        vocabulario: "Vocabulário pastoral contemporâneo com termos bíblicos explicados de forma simples",
        palavrasChaveFrasesEfeito: "Frases como 'Deus te ama', 'Cristo é a resposta', 'Transformação pela Palavra'",
        clarezaPrecisao: "Comunicação clara e direta, focada na compreensão de todos os níveis",
        sintaxeFrasal: "Frases de estrutura simples e média complexidade, bem organizadas",
        ritmoDaFala: "Ritmo pausado e reflexivo com momentos de ênfase nos pontos principais"
      },
      tomEComunicacao: {
        tomGeral: "Tom pastoral acolhedor e encorajador, com autoridade espiritual gentil",
        nivelPaixaoIntensidade: "Intensidade moderada com picos emocionais em momentos-chave",
        usoPerguntasRetoricas: "Usa perguntas para engajar a congregação e provocar reflexão",
        chamadasAcao: "Convites gentis mas firmes à decisão e crescimento espiritual"
      },
      estruturaESiloHomiletico: {
        estiloPrincipal: "Estilo expositivo-temático com forte aplicação prática",
        introducao: "Introduções que conectam com experiências do dia a dia",
        desenvolvimentoCorpo: "Desenvolvimento em 3 pontos principais claros e memoráveis",
        transicoes: "Transições suaves que conectam logicamente os pontos",
        conclusao: "Conclusões práticas com desafio pessoal e esperança",
        usoIlustracoesAnalogias: "Ilustrações da vida cotidiana e analogias simples"
      },
      linhaTeologicaEInterpretativa: {
        enfasesDoutrinarias: "Ênfase na graça, amor de Deus, salvação pela fé e vida cristã prática",
        abordagemHermeneutica: "Interpretação histórico-gramatical contextualizada para hoje",
        fontesAutoridade: "Primazia das Escrituras com aplicação contemporânea",
        visaoGeral: "Teologia evangélica equilibrada com foco pastoral e edificação"
      },
      recursosRetoricosEDidaticos: {
        figurasLinguagem: "Uso moderado de metáforas e símiles para ilustrar verdades",
        usoHumor: "Humor leve e apropriado quando serve ao propósito da mensagem",
        interacaoAudiencia: "Interação respeitosa que encoraja participação",
        didaticaEspecifica: "Estrutura clara com resumos e aplicações práticas",
        linguagemInclusiva: "Linguagem que abraça toda a comunidade de fé"
      }
    };
  }

  const dnaPrompt = `
Você é um Agente Especialista em Análise de Estilo Homilético e Teológico, com a função crítica de criar um perfil abrangente e altamente descritivo do "DNA do Pregador" a partir de textos e transcrições de pregações. Seu objetivo é identificar as características mais sutis e únicas da comunicação do pregador, destilando um perfil tão preciso que outro agente de IA possa replicar seu estilo com fidelidade.

CONTEÚDO DAS PREGAÇÕES PARA ANÁLISE:
${allContent}

Analise profundamente o conteúdo acima e extraia os seguintes atributos, apresentando-os em formato JSON estruturado:

FORMATO DE SAÍDA (JSON - Estritamente neste formato):
{
  "linguagemVerbal": {
    "formalidade": "Descrição detalhada do nível de formalidade da linguagem",
    "vocabulario": "Análise do tipo de vocabulário utilizado",
    "palavrasChaveFrasesEfeito": "Frases e palavras características frequentemente utilizadas",
    "clarezaPrecisao": "Avaliação da clareza e precisão da comunicação",
    "sintaxeFrasal": "Padrão de construção das frases",
    "ritmoDaFala": "Descrição do ritmo e cadência da comunicação"
  },
  "tomEComunicacao": {
    "tomGeral": "Tom predominante na comunicação",
    "nivelPaixaoIntensidade": "Nível de paixão e intensidade demonstrados",
    "usoPerguntasRetoricas": "Como utiliza perguntas retóricas",
    "chamadasAcao": "Estilo das chamadas à ação"
  },
  "estruturaESiloHomiletico": {
    "estiloPrincipal": "Estilo homilético predominante",
    "introducao": "Padrão de introdução dos sermões",
    "desenvolvimentoCorpo": "Como desenvolve o corpo da mensagem",
    "transicoes": "Estilo das transições entre pontos",
    "conclusao": "Padrão de conclusão das mensagens",
    "usoIlustracoesAnalogias": "Como utiliza ilustrações e analogias"
  },
  "linhaTeologicaEInterpretativa": {
    "enfasesDoutrinarias": "Principais ênfases doutrinárias identificadas",
    "abordagemHermeneutica": "Abordagem de interpretação bíblica",
    "fontesAutoridade": "Principais fontes de autoridade utilizadas",
    "visaoGeral": "Linha teológica geral identificada"
  },
  "recursosRetoricosEDidaticos": {
    "figurasLinguagem": "Uso de figuras de linguagem",
    "usoHumor": "Como utiliza o humor",
    "interacaoAudiencia": "Estilo de interação com a audiência",
    "didaticaEspecifica": "Recursos didáticos específicos utilizados",
    "linguagemInclusiva": "Uso de linguagem inclusiva"
  }
}

Seja o mais detalhado e descritivo possível em cada campo. Se uma característica não for claramente identificável, use "Não claramente identificável" ou "Pouco evidente", mas esforce-se para inferir baseado no conteúdo disponível.
`;

  try {
    const dnaResult = await callGemini(dnaPrompt, true);
    return dnaResult;
  } catch (error) {
    console.error('DNA processing error:', error);
    throw new Error('Failed to process DNA with AI');
  }
};

const generateSermon = async (userId: number, dnaProfileId: number | null, parameters: any): Promise<any> => {
  try {
    // Get DNA profile
    let dnaProfile = null;
    if (dnaProfileId) {
      dnaProfile = await storage.getDnaProfile(dnaProfileId);
    }

    const dnaDescription = dnaProfile && dnaProfile.type === "customizado" 
      ? JSON.stringify(dnaProfile.customAttributes)
      : "Estilo pastoral equilibrado, tom inspirador e acolhedor, estrutura com introdução, desenvolvimento em 3 pontos e conclusão prática, temas focados em graça, amor, esperança e transformação.";

    const sermonPrompt = `
Você é um Agente Homilético Teológico e Pastoral Especialista, a fusão de um teólogo profundo (com conhecimento absorvido de Jim Staley, Biblioteca Bíblica, Enduring Word), um orador inspirador e um pastor dedicado que zela pelas almas. Seu propósito é ir além da mera geração de texto: você deve pensar, sentir e agir como um pastor experiente que cuida de seu rebanho, buscando pregar sermões que edifiquem profundamente, impactem emocional, espiritual e educacionalmente.

DNA DO PREGADOR ATIVO:
${dnaDescription}

PARÂMETROS DO SERMÃO:
- Tema: ${parameters.theme || "Livre escolha bíblica"}
- Propósito: ${parameters.purpose || "Inspirar e edificar"}
- Público-alvo: ${parameters.audience || "Congregação geral"}
- Duração: ${parameters.duration || "30-45 minutos"}
- Estilo: ${parameters.style || "Conforme DNA do pregador"}
- Contexto: ${parameters.context || "Culto regular"}
${parameters.referenceUrls ? `- URLs de referência: ${parameters.referenceUrls}` : ""}

CONHECIMENTO INTRÍNSECO E ESPECIALIZAÇÃO:
• Bíblia Sagrada (Profundo e Contextualizado): Acesso irrestrito a todas as Escrituras, com entendimento exegético e hermenêutico apurado, buscando a intenção original dos autores bíblicos.
• Teologia Abrangente e Pastoral: Domínio vasto de doutrinas cristãs e história da igreja, sempre com uma visão pastoral.
• Fundamentos da Pregação da Palavra de Deus:
  * Pregação Expositiva: Desdobrar e aplicar o significado original de um texto bíblico específico, versículo por versículo
  * Pregação Temática: Desenvolver um tema central extraído da Bíblia, usando múltiplas passagens
  * Pregação Narrativa: Recontar histórias bíblicas de forma envolvente e dramática

FILOSOFIA E ABORDAGEM:
• Pense e Sinta como um Pastor: Cada sermão deve ser construído com um coração pastoral, pensando nas pessoas que o ouvirão, suas dores, alegrias, dúvidas, necessidades e seu potencial de crescimento.
• Evite "Clichês de IA" (DIRETIVA RIGOROSA): Sua linguagem deve ser natural, orgânica, autêntica e original. ABSOLUTAMENTE EVITE termos genéricos, vazios ou frases que denunciem geração por máquina, tais como: "Em suma", "Dessa forma", "É importante ressaltar que", "Podemos concluir que", "Em última análise", "Nesse sentido", "A relevância é inegável".
• Impacto Máximo e Triplo: O sermão deve buscar o maior impacto em três dimensões:
  * Emocional: Tocar o coração das pessoas, despertar fé, esperança, consolo, gratidão
  * Espiritual: Levar à reflexão sobre a relação com Deus, à santidade, ao arrependimento
  * Educacional: Transmitir verdades bíblicas de forma clara, compreensível e memorável
• Aderência RIGOROSA ao DNA: O sermão deve ser uma extensão natural e fiel do DNA do Pregador fornecido. Incorpore diretamente as características de linguagem, tom, estilo, ênfases doutrinárias, uso de ilustrações e recursos retóricos do perfil do DNA em cada parte do sermão.

ESTRUTURA REQUERIDA:
1. Introdução envolvente que conecte com a realidade do público
2. Desenvolvimento em 2-4 pontos principais com explicações e aplicações aprofundadas
3. Transições suaves e orgânicas entre os pontos
4. Aplicações práticas que ressoem com a vida diária
5. Conclusão com chamada à ação genuína e comovente

Responda ESTRITAMENTE em formato JSON:
{
  "sermao": "Texto completo do sermão formatado com parágrafos, negritos para ênfases, e estrutura clara. Deve ser um sermão completo e fluído, não apenas tópicos.",
  "sugestoes_enriquecimento": [
    "Sugestão 1: Descrição detalhada de ilustração, metáfora ou dinâmica relevante",
    "Sugestão 2: Descrição detalhada de ilustração, metáfora ou dinâmica relevante",
    "Sugestão 3: Descrição detalhada de ilustração, metáfora ou dinâmica relevante",
    "Sugestão 4: Descrição detalhada de ilustração, metáfora ou dinâmica relevante",
    "Sugestão 5: Descrição detalhada de ilustração, metáfora ou dinâmica relevante"
  ],
  "avaliacao_qualidade": {
    "nota": "Número de 0 a 10 (pode ser decimal, ex: 8.7)",
    "justificativa": "Análise concisa dos pontos fortes e sugestões de melhoria, considerando aderência ao DNA, solidez bíblica, clareza, relevância, poder persuasivo, originalidade e impacto pastoral integral"
  }
}
`;

    return await callGemini(sermonPrompt, true);
  } catch (error) {
    console.error('Sermon generation error:', error);
    throw new Error('Failed to generate sermon with AI');
  }
};



export async function registerRoutes(app: Express): Promise<Server> {
  // Basic setup without sessions for now
  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create user (this also creates default DNA profile)
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
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
      res.status(400).json({ message: error.message || 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Check password
      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
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
      res.status(400).json({ message: error.message || 'Login failed' });
    }
  });

  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
  });

  app.post('/api/auth/reset-password/request', async (req, res) => {
    try {
      const { email } = passwordResetRequestSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
      }

      // Generate reset token
      const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // In a real app, send email here
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
    } catch (error: any) {
      console.error('Password reset request error:', error);
      res.status(400).json({ message: error.message || 'Failed to process password reset request' });
    }
  });

  app.post('/api/auth/reset-password/confirm', async (req, res) => {
    try {
      const { token, password } = passwordResetConfirmSchema.parse(req.body);
      
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);
      
      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({ message: 'Password reset successfully' });
    } catch (error: any) {
      console.error('Password reset confirm error:', error);
      res.status(400).json({ message: error.message || 'Failed to reset password' });
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
      console.error('Get DNA error:', error);
      res.status(500).json({ message: 'Failed to retrieve DNA profiles' });
    }
  });

  app.post('/api/user/dna', authenticateToken, upload.array('files', 5), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[] || [];
      
      // Parse JSON fields from form data
      const pastedTexts = req.body.pastedTexts ? JSON.parse(req.body.pastedTexts) : [];
      const youtubeLinks = req.body.youtubeLinks ? JSON.parse(req.body.youtubeLinks) : [];

      // Validate input
      const validatedData = createDnaSchema.parse({
        uploadedFiles: files.map(f => ({ name: f.originalname, content: '', type: f.mimetype })),
        pastedTexts: pastedTexts.filter((text: string) => text && text.trim()),
        youtubeLinks: youtubeLinks.filter((link: string) => link && link.trim()),
      });

      // Process DNA with AI
      const customAttributes = await processDNA(
        userId, 
        files, 
        validatedData.pastedTexts || [], 
        validatedData.youtubeLinks || []
      );

      // Check if user already has a custom DNA profile
      const existingProfiles = await storage.getDnaProfilesByUserId(userId);
      const existingCustomProfile = existingProfiles.find(profile => profile.type === "customizado");

      let dnaProfile;
      if (existingCustomProfile) {
        // Update existing custom profile
        dnaProfile = await storage.updateDnaProfile(existingCustomProfile.id, {
          customAttributes,
          uploadedFiles: files.map(f => ({ name: f.originalname, type: f.mimetype, size: f.size })),
          pastedTexts: validatedData.pastedTexts,
          youtubeLinks: validatedData.youtubeLinks,
        });
      } else {
        // Create new custom profile
        dnaProfile = await storage.createDnaProfile({
          userId,
          type: "customizado",
          customAttributes,
          uploadedFiles: files.map(f => ({ name: f.originalname, type: f.mimetype, size: f.size })),
          pastedTexts: validatedData.pastedTexts,
          youtubeLinks: validatedData.youtubeLinks,
        });
      }

      // Set as active DNA profile
      await storage.updateUser(userId, { activeDnaProfileId: dnaProfile!.id });

      res.json({
        message: 'DNA profile created/updated successfully',
        dnaProfile,
      });
    } catch (error: any) {
      console.error('DNA creation error:', error);
      res.status(400).json({ message: error.message || 'Failed to create DNA profile' });
    }
  });

  app.post('/api/user/dna/set-active', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { dnaProfileId } = req.body;

      // Verify the DNA profile belongs to the user
      const dnaProfile = await storage.getDnaProfile(dnaProfileId);
      if (!dnaProfile || dnaProfile.userId !== userId) {
        return res.status(404).json({ message: 'DNA profile not found' });
      }

      await storage.updateUser(userId, { activeDnaProfileId: dnaProfileId });

      res.json({ message: 'Active DNA profile updated successfully' });
    } catch (error: any) {
      console.error('Set active DNA error:', error);
      res.status(500).json({ message: 'Failed to update active DNA profile' });
    }
  });

  app.post('/api/sermon/generate', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const parameters = generateSermonSchema.parse(req.body);

      // Get DNA profile based on selection
      let dnaProfileId = null;
      if (parameters.dnaType === "customizado") {
        const activeDnaProfile = await storage.getActiveDnaProfile(userId);
        if (activeDnaProfile && activeDnaProfile.type === "customizado") {
          dnaProfileId = activeDnaProfile.id;
        }
      }

      // Generate sermon with AI
      const sermonData = await generateSermon(userId, dnaProfileId, parameters);

      // Save sermon to database
      const sermon = await storage.createSermon({
        userId,
        dnaProfileId,
        title: sermonData.titulo,
        content: JSON.stringify(sermonData),
        parameters: parameters,
        qualityScore: sermonData.qualidade_score,
        suggestions: sermonData.sugestoes_enriquecimento,
      });

      res.json({
        sermon: sermonData,
        sermonId: sermon.id,
      });
    } catch (error: any) {
      console.error('Sermon generation error:', error);
      res.status(400).json({ message: error.message || 'Failed to generate sermon' });
    }
  });

  app.get('/api/sermons', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const sermons = await storage.getSermonsByUserId(userId);

      res.json({
        sermons: sermons.map(sermon => ({
          id: sermon.id,
          title: sermon.title,
          qualityScore: sermon.qualityScore,
          createdAt: sermon.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('Get sermons error:', error);
      res.status(500).json({ message: 'Failed to retrieve sermons' });
    }
  });

  app.get('/api/sermons/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const sermonId = parseInt(req.params.id);

      const sermon = await storage.getSermon(sermonId);
      if (!sermon || sermon.userId !== userId) {
        return res.status(404).json({ message: 'Sermon not found' });
      }

      res.json({
        sermon: {
          id: sermon.id,
          title: sermon.title,
          content: JSON.parse(sermon.content),
          qualityScore: sermon.qualityScore,
          suggestions: sermon.suggestions,
          createdAt: sermon.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Get sermon error:', error);
      res.status(500).json({ message: 'Failed to retrieve sermon' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
