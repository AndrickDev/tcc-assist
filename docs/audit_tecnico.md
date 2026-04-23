# Teseo — Relatório Técnico e de Produto
## Auditoria completa · Abril 2026

> **Uso interno** — documento preparado para apresentação a sócios e colaboradores.  
> Linguagem: Português Brasileiro.  
> Legenda: ✅ Pronto · ⚠️ Parcial · 🔶 Simulado · ❌ Não implementado · *(não confirmado)* = hipótese

---

## 1. Visão Geral do Produto

### O que é o Teseo

O Teseo é uma plataforma SaaS de assistência à escrita acadêmica voltada para o mercado brasileiro. Seu diferencial não é ser um assistente genérico de IA, mas sim um produto que entende o contexto acadêmico: tipo de trabalho, instituição, norma de formatação, área de conhecimento e objetivo da pesquisa.

### Problema que resolve

Estudantes brasileiros que precisam escrever TCCs, monografias, dissertações e teses enfrentam três barreiras principais:

1. **Estrutura** — não sabem como organizar os capítulos e seções obrigatórias
2. **Conteúdo** — têm dificuldade em escrever com linguagem acadêmica formal e coesa
3. **Formatação** — as normas ABNT são complexas e os erros de formatação geram reprovações

O Teseo atua nas três frentes com IA contextualizada.

### Público-alvo principal

- Estudantes de graduação em fase de TCC (foco primário)
- Estudantes de pós-graduação (mestrado, doutorado) — expansão natural
- Professores orientadores — oportunidade de produto secundário

### Proposta de valor atual

> "Escreva seu TCC com uma IA que conhece as normas ABNT, o seu curso e o seu objetivo de pesquisa — sem as respostas genéricas do ChatGPT."

---

## 2. Auditoria de Funcionalidades

### 2.1 Pronto e funcionando

| Funcionalidade | Detalhes |
|---|---|
| Autenticação (e-mail/senha + Google OAuth) | NextAuth v5 com Prisma adapter. bcryptjs para hashing. JWT com role e plan |
| Dashboard — listagem e criação de TCCs | Grid de cards, empty state, greeting personalizado, KPIs, upgrade banner |
| Modal de criação (5 passos) | Tipo de trabalho, curso, instituição, norma (ABNT/APA/Vancouver), objetivo |
| Editor rich text | Tiptap com autosave (debounce 2s), indicador de estado, fullscreen |
| Chat com IA — agentes especializados | Bibliotecário (referências), Arquiteto (estrutura), Redator (capítulos) |
| Ações de IA inline | Revisar, Norma ABNT, Citações, Próximo passo — com guardrails de prompt |
| Sistema de planos com limites | FREE / PRO / VIP — centralizado em `plan.ts`, aplicado na UI e na API |
| Modo de revisão comparativa | Layout 3 colunas: original, sugestão, análise. Aceitar/Rejeitar. |
| Upload de arquivos (PDF/DOC) | Vercel Blob, 20 MB por arquivo, limites por plano (5/20/50) |
| Upload de imagens no editor | Até 10 por TCC, 5 MB cada, Vercel Blob com fallback base64 |
| Exportação PDF | html2canvas + jsPDF. Marca d'água no FREE, PDF limpo no PRO/VIP |
| Integração Stripe | Pagamento único (não assinatura), webhook atualiza plano no banco |
| Analytics — 17 eventos tipados | Funil completo: onboarding → criação → workspace → monetização |
| Painel admin | Listagem de usuários, troca de plano, reset de limites |
| Landing page completa | Hero, features, workflow, preços, FAQ, footer |
| Design system Teseo | Cores, tipografia e componentes padronizados |

### 2.2 Parcial / Com limitações

| Funcionalidade | Status | Limitação conhecida |
|---|---|---|
| Proteção de rotas da API | ⚠️ **Bug B6** | Nem todas as rotas `/api/tcc/[id]/*` verificam se o TCC pertence ao usuário autenticado |
| Limite diário de mensagens | ⚠️ **Bug B5** | Armazenado em `localStorage`. Fácil de burlar via DevTools |
| Analytics — envio externo | ⚠️ Parcial | Eventos disparados mas só vão para `console.info`. PostHog/Mixpanel não configurados |
| Configurações do usuário | ⚠️ Parcial | Apenas edição de nome. Sem senha, foto de perfil ou preferências |
| Conformidade LGPD | ⚠️ Parcial | Sem página de política de privacidade, sem endpoint de exclusão de dados |

### 2.3 Simulado (não real)

| Funcionalidade | Situação |
|---|---|
| Índice de plágio / similaridade | 🔶 **Simulado** — valor calculado localmente sem integração real. Exibir disclaimer ou remover |
| Autoria humana (%) | 🔶 **Simulado** — cálculo local não validado. Sem integração com detector de IA |

### 2.4 Não implementado

| Funcionalidade | Prioridade | Observação |
|---|---|---|
| Serviço de e-mail | Alta | Nenhum provider integrado (SendGrid, Resend, etc.) |
| Recuperação de senha | Alta | Fluxo não implementado |
| Rate limiting nas APIs de IA | Alta | Risco de abuso e custo descontrolado |
| Política de privacidade / Termos | Alta | **Obrigatório pela LGPD** |
| Verificação de e-mail no cadastro | Média | Permite contas com e-mails inválidos |
| Histórico de versões do documento | Média | Planejado, não iniciado |
| Painel do orientador | Média | Alta oportunidade, não iniciado |
| RAG com PDFs do usuário | Média | Requer backend separado *(não confirmado)* |
| Exportação Word (.docx) com ABNT | Média | Apenas PDF hoje |
| Testes automatizados | Média | Zero arquivos de teste no repositório |
| Verificador de originalidade real | Baixa | Integração Turnitin/Copyleaks *(não confirmado)* |
| Colaboração em tempo real | Baixa | Sem WebSocket ou CRDTs |
| App mobile | Baixa | Web responsivo apenas |

---

## 3. Auditoria Técnica

### 3.1 Stack completa

#### Frontend
- **Framework:** Next.js 15.5 com App Router
- **UI:** React 19, TypeScript, Tailwind CSS
- **Componentes:** Base UI (Radix-compatible), Lucide Icons
- **Editor:** Tiptap v3 (rich text, extensível)
- **Animação:** Framer Motion
- **Tema:** next-themes (dark/light mode)

#### Backend (embutido no Next.js)
- **API Routes:** 18 endpoints REST (arquivo-por-rota no App Router)
- **ORM:** Prisma v5.22 com PostgreSQL
- **Auth:** NextAuth v5 (beta) — Credentials + Google OAuth
- **Pagamento:** Stripe SDK v20 (pagamento único, webhook)
- **Storage:** Vercel Blob (arquivos e imagens)

#### Inteligência Artificial
- **Provedor primário:** Google Gemini Flash (`gemini-flash-latest`)
- **Abstração:** `src/lib/ai/provider.ts` — suporte a múltiplos provedores
- **Agentes:** Bibliotecário, Arquiteto, Redator (variações por plano)
- **Guardrails:** `src/lib/agents/guardrails.ts` — prevenção de metalinguagem e placeholders
- **GPT:** arquitetura pronta, implementação pendente (`throw 'not yet implemented'`)

#### Infraestrutura
- **Deploy:** Vercel (inferido por configuração e `.vercel/`)
- **Banco:** PostgreSQL via Prisma.io (free tier)
- **Blob storage:** Vercel Blob
- **Variáveis de ambiente:** `.env.example` documentado

### 3.2 Estrutura de rotas

```
src/app/
├── page.tsx                          # Landing page
├── login/page.tsx                    # Login
├── register/page.tsx                 # Cadastro
├── pricing/page.tsx                  # Preços
├── dashboard/page.tsx                # Dashboard principal
├── tcc/[id]/page.tsx                 # Workspace do TCC
├── configuracoes/page.tsx            # Configurações do usuário
├── suporte/page.tsx                  # Suporte
├── admin/users/page.tsx              # Admin — usuários
└── api/
    ├── auth/[...nextauth]/           # NextAuth handler
    ├── register/                     # Cadastro
    ├── user/profile/                 # Atualizar perfil
    ├── tcc/                          # CRUD de TCCs
    ├── tcc/[id]/                     # TCC específico
    ├── tcc/[id]/messages/            # Histórico de chat
    ├── tcc/[id]/attachments/         # Uploads de arquivos
    ├── tcc/[id]/image/               # Upload de imagens
    ├── tcc/[id]/ai-action/           # Ações inline de IA
    ├── chat/                         # Enviar mensagem ao agente
    ├── gerar-tcc/                    # Geração de capítulo
    ├── stripe/checkout/              # Criar sessão Stripe
    ├── stripe/webhook/               # Webhook de pagamento
    └── admin/users/                  # Admin: listar e gerenciar
```

### 3.3 Schema do banco de dados

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  password      String?           // credentials auth
  role          Role      @default(USER)     // USER | ADMIN
  plan          Plan      @default(FREE)     // FREE | PRO | VIP
  planExpiresAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  tccs          Tcc[]
  accounts      Account[]
  sessions      Session[]
}

model Tcc {
  id          String      @id @default(cuid())
  userId      String
  title       String
  course      String
  institution String
  status      TccStatus   @default(IN_PROGRESS)
  norma       String?     // ABNT | APA | Vancouver | Chicago | Outra
  workType    String?     // TCC | Monografia | Dissertação | Tese | Artigo
  objective   String?
  content     String?     // HTML do editor
  deadline    DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  user        User        @relation(...)
  messages    Message[]
  attachments Attachment[]
}

model Message {
  id        String      @id @default(cuid())
  tccId     String
  role      MessageRole  // user | bot
  content   String       // HTML ou texto
  agent     String?      // redator-free | redator-pro | redator-vip
  createdAt DateTime     @default(now())
}

model Attachment {
  id        String   @id @default(cuid())
  tccId     String
  fileName  String
  fileUrl   String   // URL Vercel Blob
  fileSize  Int
  mimeType  String
  createdAt DateTime @default(now())
}
```

### 3.4 Sistema de planos

| Feature | FREE | PRO | VIP |
|---|---|---|---|
| TCCs simultâneos | 1 | 1 | 2 |
| Mensagens de IA / dia | 3 | 50 | Ilimitado |
| Anexos por TCC | 5 | 20 | 50 |
| Ação: Revisar | ❌ | ✅ Básico | ✅ Avançado |
| Ação: Norma ABNT | ❌ | ❌ | ✅ |
| Ação: Citações | ❌ | ❌ | ✅ |
| Ação: Próximo passo | ❌ | ❌ | ✅ |
| Exportação PDF | Com marca d'água | Limpo | Limpo |
| Contexto de chat (mensagens) | 0 | 3 anteriores | 8 anteriores |
| Tokens de geração (Gemini) | 2.000 (~1 pág.) | 6.000 (~3 pág.) | 16.000 (~8 pág.) |

### 3.5 Analytics (17 eventos)

Eventos mapeados por fase do funil:

- **Onboarding:** `TCC_CREATED`, `ONBOARDING_STEP`, `TCC_DELETED`
- **Workspace:** `WORKSPACE_OPEN`, `MANUAL_SAVE_TCC`, `INSERT_SUGGESTION_DOCUMENT`, `AI_SUGGESTION_REGENERATE`
- **Ações de IA:** `AI_ACTION_CLICK`, `AI_ACTION_BLOCK_PLAN`, `AI_ACTION_SUCCESS`, `AI_ACTION_ERROR`, `AI_PANEL_TOGGLE_NEXT_STEP`
- **Revisão:** `REVIEW_ACCEPTED`, `REVIEW_REJECTED`
- **Monetização:** `UPGRADE_MODAL_SHOWN`, `UPGRADE_CTA_CLICK`, `LIMIT_MODAL_SHOWN`, `EXPORT_CLICK`
- **Engajamento:** `TURNITIN_INFO_HOVER`

**Status:** Eventos disparados e tipados. Destino atual: `console.info` (produção) e `console.debug` (dev). Nenhum provider externo configurado ainda.

---

## 4. Riscos e Limitações

### 4.1 Riscos de segurança

**B6 — Alta prioridade**
> Verificar se todas as rotas `/api/tcc/[id]/*` validam que o TCC pertence ao `userId` da sessão autenticada. Um usuário mal-intencionado pode acessar ou modificar dados de outro usuário se o ID do TCC for adivinhado.

**B5 — Média prioridade**
> O contador de mensagens diárias é gravado em `localStorage`. Pode ser zerado por qualquer usuário com acesso ao DevTools. Mover para coluna no banco (`dailyMessageCount`, `lastMessageDate`) antes de escalar.

**Sem rate limiting**
> As rotas `/api/chat` e `/api/gerar-tcc` não têm limitação de chamadas no servidor. Um script simples poderia gerar custos elevados na API do Gemini.

### 4.2 Riscos legais (Brasil)

**LGPD — Lei 13.709/2018**
> O produto coleta dados pessoais (nome, e-mail, dados do trabalho acadêmico) sem:
> - Política de privacidade publicada
> - Termos de uso
> - Mecanismo de exclusão de conta e dados (Art. 18)
> - Mecanismo de exportação de dados pessoais (Art. 18, II)
> - Banner de consentimento para analytics
>
> **Isso é ilegal para operar no Brasil. Prioridade máxima antes de abrir cadastro público.**

### 4.3 Riscos de produto

**Índice de plágio simulado**
> O workspace exibe um percentual de similaridade que não é calculado por nenhuma engine real. Se um estudante ou professor confiar nesse dado, pode haver problema de credibilidade e, dependendo do contexto, responsabilidade civil.

**Sem e-mail = sem retenção**
> Sem verificação de e-mail e sem recuperação de senha, a taxa de perda de usuários por problemas de acesso é alta.

### 4.4 Limitações técnicas do Next.js para IA

| Limitação | Impacto | Quando se torna problema |
|---|---|---|
| Timeout de 10s em Vercel Serverless | Geração longa pode falhar | Com textos > 3 páginas |
| Sem suporte nativo a filas de jobs | Processamento assíncrono impossível | RAG, embeddings, PDF parsing |
| Sem processo persistente | Não há cache de modelos em memória | Alta latência de cold start |
| Dependência do ecossistema JS | Bibliotecas Python de IA não disponíveis | LangChain, LlamaIndex, HuggingFace |

---

## 5. Comparação de Arquiteturas

### 5.1 Next.js puro (estado atual)

**Vantagens:**
- Um único repositório e deploy
- Nenhuma complexidade adicional de devops
- Suficiente para o beta e primeiros pagantes

**Desvantagens:**
- Timeout de função serverless (~10s na Vercel)
- Sem suporte nativo a jobs assíncronos
- Impossível usar LangChain, LlamaIndex, PyPDF, HuggingFace nativamente
- Difícil implementar RAG com banco vetorial

**Recomendação:** Manter durante o beta. Migrar quando RAG for necessário.

---

### 5.2 Next.js + FastAPI ⭐ Recomendado para o futuro

**Descrição:** Frontend e rotas de autenticação/pagamento permanecem no Next.js. Um serviço FastAPI separado gerencia todo o processamento de IA, RAG e geração de conteúdo.

**Vantagens:**
- FastAPI tem tipagem nativa (Pydantic), documentação automática (Swagger/OpenAPI)
- `asyncio` nativo — ideal para chamadas de LLM concorrentes
- Acesso a todo o ecossistema Python de IA: LangChain, LlamaIndex, sentence-transformers, etc.
- Sem timeout — pode processar documentos longos e pipelines complexos
- Fácil integrar filas (Celery + Redis) para jobs assíncronos
- Pode rodar como container no Railway, Render, Fly.io ou AWS ECS

**Desvantagens:**
- Dois repositórios (ou monorepo com mais complexidade)
- Necessidade de gerenciar CORS e autenticação entre serviços (JWT compartilhado)
- Custo levemente maior (servidor Python adicional)

**Arquitetura sugerida:**

```
Next.js (Vercel)                FastAPI (Railway/Render)
├── /api/auth/*           →     (NextAuth no Next)
├── /api/stripe/*         →     (Stripe no Next)
├── /api/tcc/* (CRUD)     →     (Prisma no Next)
└── /api/ai/*             →     FastAPI
                                ├── POST /generate-chapter
                                ├── POST /rag-query
                                ├── POST /embed-document
                                └── POST /check-abnt
```

---

### 5.3 Next.js + Django

**Vantagens:**
- Framework mais maduro com admin embutido
- ORM Django poderoso com migrations robustas
- Celery + Django bem documentado

**Desvantagens:**
- Configuração inicial pesada
- Dois ORMs (Prisma no Next + Django ORM no backend) é redundante
- Django é mais lento que FastAPI para endpoints de IA
- Curva de aprendizado maior para um time pequeno

**Recomendação:** Não recomendado para este cenário. Overkill para a fase atual.

---

### 5.4 Next.js + Flask

**Vantagens:**
- Extremamente simples de configurar
- Acesso ao ecossistema Python

**Desvantagens:**
- Flask é síncrono por padrão (necessita gevent ou gunicorn para concorrência)
- Sem tipagem nativa
- Sem documentação automática
- Menos estruturado: fácil de criar código difícil de manter

**Recomendação:** Não recomendado. FastAPI entrega os mesmos benefícios com muito mais qualidade.

---

### Resumo comparativo

| Critério | Next.js puro | + FastAPI ⭐ | + Django | + Flask |
|---|---|---|---|---|
| Simplicidade | ✅ Alta | ⚠️ Média | ❌ Baixa | ⚠️ Média |
| IA / RAG | ❌ Limitado | ✅ Excelente | ✅ Bom | ✅ Bom |
| Async / Jobs | ❌ | ✅ asyncio + Celery | ✅ Celery maduro | ⚠️ Manual |
| Manutenibilidade | ✅ 1 repo | ⚠️ 2 repos | ⚠️ 2 repos | ❌ Frágil |
| Timeout | ❌ 10s | ✅ Ilimitado | ✅ Ilimitado | ✅ Ilimitado |
| Fit para este produto | ✅ Agora | ✅ Em 6 meses | ⚠️ Pesado | ⚠️ Frágil |

---

## 6. Oportunidades para o Mercado Brasileiro

### 6.1 Conformidade ABNT (alta prioridade)

A verificação real de conformidade ABNT seria um diferencial fortíssimo. Isso inclui:

- Margens corretas (superior/esquerda 3cm, inferior/direita 2cm)
- Fonte Times New Roman ou Arial, tamanho 12
- Espaçamento entre linhas 1,5
- Citações diretas longas (bloco recuado 4cm)
- Formatação de referências bibliográficas (NBR 6023:2018)
- Numeração de páginas, sumário automático

**Status atual:** A ação "Norma ABNT" existe como ação de IA (VIP), mas não faz verificação estrutural real.

### 6.2 Templates por tipo de trabalho e área

Estudantes de Direito têm um TCC muito diferente de Engenharia ou Psicologia. Templates específicos por área aumentam a percepção de valor.

### 6.3 Painel do orientador

Um módulo onde o professor pode:
- Acompanhar o progresso do aluno
- Fazer comentários diretamente no documento
- Aprovar ou devolver capítulos
- Visualizar o histórico de versões

Abre um modelo B2B (venda para coordenações/universidades).

### 6.4 RAG com PDFs do usuário *(não confirmado)*

Permitir que o aluno suba artigos, livros e referências. A IA passa a citar diretamente esses documentos, com número de página e trecho. Reduz alucinação e aumenta muito a confiança no produto.

Requer: FastAPI + banco vetorial (Supabase pgvector, Pinecone ou Weaviate).

### 6.5 Exportação Word com estilos ABNT

A exportação PDF atual usa html2canvas, que tem qualidade limitada (não embute fontes corretamente, não suporta quebra de página automática). Uma exportação `.docx` com estilos ABNT aplicados seria percebida como muito mais profissional.

Biblioteca sugerida: `python-docx` ou `pandoc` via FastAPI.

### 6.6 Verificação de originalidade *(não confirmado)*

Integração com Turnitin, Copyleaks ou Compilatio — ferramentas usadas pelas universidades brasileiras. Substituiria o índice simulado atual com dados reais.

### 6.7 LGPD e segurança de dados

Para o mercado institucional (universidades), a conformidade com LGPD é requisito de contratação. Investir nisso não é só legal — é diferencial comercial.

---

## 7. Roadmap

### 7.1 Curto prazo — Próximas 4 semanas

| # | Tarefa | Tipo |
|---|---|---|
| 1 | Corrigir Bug B6 — autorização em todas as rotas API | Segurança |
| 2 | Publicar política de privacidade e termos de uso | Legal/LGPD |
| 3 | Remover ou desativar índice de plágio simulado | Credibilidade |
| 4 | Rate limiting nas APIs de IA (Upstash Redis) | Segurança/Custo |
| 5 | Integrar Resend ou SendGrid (e-mail transacional) | Retenção |
| 6 | Implementar recuperação de senha | UX |
| 7 | Mover limite diário de localStorage para o banco | Segurança |
| 8 | Conectar analytics ao PostHog | Dados |
| 9 | Recrutar 5 beta testers e coletar feedback | Validação |

### 7.2 Médio prazo — 1 a 3 meses

| # | Tarefa | Tipo |
|---|---|---|
| 10 | Histórico de versões do documento (últimas 10 versões) | Produto |
| 11 | Templates de estrutura por tipo de trabalho e área | Produto |
| 12 | Exportação Word (.docx) com estilos ABNT | Produto |
| 13 | Separar backend IA em FastAPI (piloto) | Arquitetura |
| 14 | RAG básico com PDFs enviados pelo usuário | Produto/IA |
| 15 | Painel do orientador — MVP (leitura + comentários) | Produto |
| 16 | Verificação ABNT estrutural na exportação | Produto |
| 17 | Testes automatizados (cobertura do fluxo crítico) | Qualidade |

### 7.3 Longo prazo — 3 a 12 meses

| # | Tarefa | Tipo |
|---|---|---|
| 18 | RAG avançado com banco vetorial e citações com fonte | IA |
| 19 | Integração com verificador de originalidade real | Produto |
| 20 | Plano institucional B2B (universidades) | Negócio |
| 21 | Detecção de lacunas de citação e sugestão de referências | IA |
| 22 | Colaboração em tempo real (co-autoria) | Produto |
| 23 | Timeline de evolução do TCC | Produto |
| 24 | App mobile (PWA ou React Native) | Produto |
| 25 | API pública documentada para integrações | Produto |

### 7.4 Por maturidade do produto

**MVP real** = Estado atual + Segurança (B6) + LGPD  
O core loop já existe. O MVP real é corrigir o que impede o cadastro público seguro.

**Versão vendável** = MVP real + E-mail + Word/ABNT + Orientador  
Com e-mail funcional, exportação de qualidade e painel do orientador, a proposta de valor é clara o suficiente para pagar e recomendar.

**Versão defensável** = Versão vendável + RAG com PDFs + Verificador real  
RAG com documentos do usuário e verificação de originalidade real criam barreiras competitivas que ferramentas genéricas não conseguem replicar.

---

## 8. Como os Sócios Podem Contribuir sem Programar

### 8.1 Pesquisa com usuários

**O que fazer:**
- Recrutar 5 a 10 estudantes em fase de TCC via contatos pessoais, grupos de Facebook/WhatsApp, CAASO, etc.
- Realizar entrevistas de 30 minutos com roteiro semi-estruturado
- Gravar (com consentimento) ou anotar em tempo real

**O que perguntar:**
- Como você está escrevendo seu TCC hoje?
- Quais são suas maiores dificuldades?
- Você já usou alguma IA para ajudar? Como foi?
- O que uma ferramenta precisaria ter para você pagar por ela?

**Onde documentar:** Notion — página "Pesquisa de Usuários" com perfil do entrevistado, dores mapeadas e citações literais.

### 8.2 Benchmark de concorrentes

**O que fazer:**
- Criar conta e testar: ChatGPT, Gamma, Notion AI, TCC Fácil, Monografia Online
- Registrar: preço, funcionalidades, diferencial, fraquezas
- Criar uma tabela comparativa no Notion

**Resultado esperado:** Documento que mostra claramente onde o Teseo é melhor e onde precisa evoluir.

### 8.3 QA — Testes de produto

**O que fazer:**
- Seguir o fluxo completo: cadastro → criar TCC → gerar capítulo → exportar PDF
- Testar o fluxo de pagamento (modo de teste do Stripe: cartão 4242 4242 4242 4242)
- Registrar qualquer bug, confusão ou comportamento inesperado

**Como registrar:** Criar card no Trello com: print da tela, descrição do problema, passos para reproduzir.

### 8.4 Documentos legais

**O que fazer:**
- Rascunhar política de privacidade usando modelos públicos como base
- Identificar quais dados o produto coleta e para qual finalidade
- Consultar um advogado especializado em LGPD para revisão

**Referência:** ANPD (Autoridade Nacional de Proteção de Dados) — anpd.gov.br

### 8.5 Relacionamento acadêmico

**O que fazer:**
- Contatar professores orientadores com proposta de feedback
- Apresentar o produto para coordenações de TCC
- Negociar acesso de 10 alunos para um piloto gratuito em troca de feedback estruturado

### 8.6 Conteúdo e comunicação

**O que fazer:**
- Revisar textos da landing page com olhar de estudante
- Criar 5 posts curtos para TikTok/Instagram mostrando um caso de uso real
- Expandir a seção de FAQ com dúvidas reais coletadas nas entrevistas

---

## 9. Organização do Time (Trello + Notion)

### 9.1 Trello — Execução semanal

**Quadro:** "Teseo — Sprint"

**Colunas:**
1. 🔴 **Bloqueios** — problemas urgentes que travam o time
2. 📋 **Backlog** — tudo o que pode ser feito, priorizado
3. 🎯 **Sprint atual** — máximo 5 cards por vez
4. 🔄 **Em revisão** — pronto para testar ou aprovar
5. ✅ **Concluído** — arquivar semanalmente

**Etiquetas:** `dev`, `design`, `legal`, `pesquisa`, `conteúdo`, `bug`

**Cada card deve ter:** responsável, etiqueta, checklist, link para Notion se houver documentação.

### 9.2 Notion — Documentação e contexto

**Estrutura sugerida:**

```
📁 Teseo Wiki
├── 📄 Status do produto (este documento)
├── 📅 Roadmap visual (timeline com datas)
├── 👤 Pesquisa de usuários
│   ├── Entrevistas realizadas
│   └── Insights consolidados
├── 🔍 Benchmark de concorrentes
├── 🐛 Bugs conhecidos (B1–B6 + novos)
├── ⚖️ Legal e LGPD
│   ├── Rascunho da política de privacidade
│   └── Rascunho dos termos de uso
├── 💻 Decisões técnicas
└── 📊 Métricas (quando analytics estiver ativo)
```

### 9.3 Ritual semanal

**Segunda-feira — 30 minutos:**
1. O que foi feito na semana anterior?
2. O que está bloqueado?
3. O que entra no sprint desta semana?

Registrar decisões importantes no Notion. Mover cards no Trello durante a semana.

---

## 10. Prioridades das Próximas 2 Semanas

| # | Tarefa | Responsável | Por quê agora |
|---|---|---|---|
| 1 | Corrigir Bug B6 (autorização nas APIs) | Dev | Risco de segurança antes do cadastro público |
| 2 | Publicar política de privacidade e termos | Legal + Dev | Obrigatório pela LGPD |
| 3 | Desativar índice de plágio simulado | Dev | Dado falso prejudica credibilidade |
| 4 | Rate limiting nas APIs de IA | Dev | Protege contra custo descontrolado |
| 5 | Integrar e-mail (Resend) + recuperação de senha | Dev | Retenção básica de usuários |
| 6 | Conectar analytics ao PostHog | Dev | Sem dados reais não há como tomar decisões |
| 7 | Recrutar 5 beta testers | Sócios | O produto está pronto para validação |
| 8 | Benchmark de concorrentes | Sócios | Insumo para decisões de produto e pricing |

---

## Apêndice — Notas sobre incertezas

As seções marcadas com *(não confirmado)* indicam funcionalidades que **não foram identificadas no código atual** e representam recomendações ou hipóteses de roadmap, não fatos sobre o estado presente do produto.

O índice de plágio simulado não reflete nenhuma tecnologia real de verificação — é um valor calculado localmente para fins de demonstração.

A integração com Turnitin, Copyleaks, Compilatio ou qualquer verificador externo não foi iniciada.

O suporte a GPT-4 está na arquitetura mas não implementado (`throw 'not yet implemented'` em `src/lib/ai/provider.ts`).

---

*Teseo — Relatório Técnico e de Produto · Abril 2026*  
*Repositório: `tcc-assist-main` · Branch: `main` · Uso interno*
