
# Gerador de Sermões com IA

Uma aplicação web full-stack para gerar sermões personalizados usando Inteligência Artificial com Google Gemini.

## 🚀 Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Banco de Dados**: PostgreSQL + Drizzle ORM
- **IA**: Google Gemini
- **UI**: Tailwind CSS + Shadcn/ui
- **Autenticação**: JWT

## 📋 Funcionalidades

- ✅ Sistema de autenticação completo (login, registro, reset de senha)
- ✅ Criação e gerenciamento de DNA personalizado do pregador
- ✅ Upload de arquivos (PDF, DOC, TXT) para análise
- ✅ Geração de sermões personalizados com IA
- ✅ Interface responsiva e intuitiva

## 🛠️ Instalação e Execução

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd gerador-sermoes-ia
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
- `DATABASE_URL`: URL do banco PostgreSQL
- `GEMINI_API_KEY`: Chave da API do Google Gemini
- `JWT_SECRET`: Chave secreta para JWT

4. Execute as migrações do banco:
```bash
npm run db:push
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5000`

## 📁 Estrutura do Projeto

```
├── client/src/          # Frontend React
│   ├── components/      # Componentes UI reutilizáveis
│   ├── pages/          # Páginas da aplicação
│   ├── hooks/          # Hooks customizados
│   └── lib/            # Utilitários e configurações
├── server/             # Backend Express
├── shared/             # Schema do banco de dados
└── migrations/         # Migrações do banco
```

## 🔒 Segurança

- Senhas hasheadas com bcrypt
- Autenticação JWT
- Validação de entrada com Zod
- Upload seguro de arquivos

## 📝 Como Usar

1. **Registro**: Crie uma conta na aplicação
2. **DNA Personalizado**: Configure seu DNA de pregador através de uploads ou textos
3. **Gerar Sermão**: Use os parâmetros desejados para gerar sermões personalizados
4. **Resultado**: Visualize, copie e avalie os sermões gerados

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.
