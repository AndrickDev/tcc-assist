# TCC-ASSIST — Chat / Dashboard Principal Spec
> **Estilo:** GPT minimalista · Dark mode · tokens de `landing.md`  
> **Layout:** Fullscreen 3 colunas + header fixo · Mobile: sidebar collapsible

---

## Layout Geral

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER (56px fixed)                                            │
│  [← Novo TCC]          TCC-ASSIST          [👤 avatar] [⚙️]    │
├──────────────┬──────────────────────────────┬───────────────────┤
│ SIDEBAR ESQ  │   CHAT CENTRAL (flex-1)      │  SIDEBAR DIR      │
│  250px       │                              │  250px            │
│  (collapses  │                              │  (collapses       │
│   ≤ 768px)   │                              │   ≤ 1024px)       │
└──────────────┴──────────────────────────────┴───────────────────┘
```

```css
/* Shell */
height: 100dvh;
display: grid;
grid-template-rows: 56px 1fr;
grid-template-columns: 250px 1fr 250px;   /* ≤768px: 0 1fr 0 */
overflow: hidden;
background: #0F0F1A;
```

---

## 1. HEADER (fixed, 56px)

```
[☰] [← Novo TCC]      ✦ TCC-ASSIST      [👤 Ana]  [⚙️]
```

| Elemento | Spec |
|---|---|
| `[← Novo TCC]` | `text-sm font-medium text-slate-400` · hover: `text-white` · abre nova conversa |
| Logo centro | gradiente brand (mesmo do header do landing) · `text-sm` em mobile |
| Avatar | `32px rounded-full` gradiente · dropdown: Perfil / Assinatura / Sair |
| `[⚙️]` | Abre modal de configurações (modelo, idioma, ABNT version) |
| Fundo | `bg-[#0F0F1A]/80 backdrop-blur-md border-b border-white/5` |

---

## 2. SIDEBAR ESQUERDA (250px)

```
  ┌─────────────────────┐
  │  + Novo TCC          │  ← botão topo
  │  ─────────────────  │
  │  RECENTES            │
  │  💬 TCC Direito LGPD │
  │  💬 TCC ADM Mkt Dig  │
  │  💬 TCC TI DevOps    │
  │  ─────────────────  │
  │  📁 UPLOAD NORMAS    │
  │  [Arrastar PDF aqui] │
  │  ─────────────────  │
  │  📋 TEMPLATES         │
  │  [Direito]           │
  │  [ADM]               │
  │  [TI]                │
  │  [Saúde] [Edu]       │
  └─────────────────────┘
```

### Seções

**Histórico de conversas**
- Lista escrolável · item: `py-2 px-3 rounded-lg text-sm text-slate-300`  
- Item ativo: `bg-white/8 text-white`  
- Hover: `bg-white/5`  
- Overflow text: `truncate max-w-[190px]`  
- Tooltip com título completo on hover

**Upload PDF normas**
- Dropzone: `border-dashed border border-white/15 rounded-xl p-4 text-center text-xs text-slate-500`  
- Hover/drag-over: `border-purple-500/60 bg-purple-500/5`  
- Ícone `📁` + texto "Arraste o PDF de normas da sua faculdade"  
- Após upload: badge com nome do arquivo + `×` para remover

**Templates**
- Chips pill: `bg-white/6 border border-white/10 text-xs px-3 py-1 rounded-full`  
- Hover: `border-purple-500/50`  
- Click: preenche prompt inicial no chat

---

## 3. CHAT CENTRAL

### Área de mensagens

```
  [BOT]  Olá! Qual é o tema do seu TCC?          ← bubble esquerda
                   Direito Penal e LGPD  [USER]   ← bubble direita
  [BOT]  Ótimo! Encontrei 12 referências...
         ┌─────────────────────────────┐
         │ EDITOR CAPÍTULO (inline)    │   ← veja seção abaixo
         └─────────────────────────────┘
```

**Bubble esquerda (bot)**
```css
max-width: 75%;
background: rgba(255,255,255,0.06);
border: 1px solid rgba(255,255,255,0.09);
border-radius: 0 1rem 1rem 1rem;
padding: 0.75rem 1rem;
color: #E2E8F0;
```

**Bubble direita (user)**
```css
max-width: 75%; margin-left: auto;
background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.3));
border: 1px solid rgba(124,58,237,0.3);
border-radius: 1rem 0 1rem 1rem;
```

**Typing indicator (bot pensando)**
```
● ● ●   — 3 dots, animation: bounce stagger 200ms cada
```

### Input bar (fixada no bottom do chat)

```
┌──────────────────────────────────────────────────────┐
│ [📎] Mensagem ou /comando...              [Enviar ↑] │
└──────────────────────────────────────────────────────┘
```

```css
position: sticky; bottom: 0;
background: #0F0F1A;
padding: 0.75rem 1rem;
border-top: 1px solid rgba(255,255,255,0.05);
```

`<textarea>` auto-resize · `rows=1 → max 6` · `resize: none`

**Toolbar acima do input:**

| Botão | Ícone | Ação |
|---|---|---|
| Anexar PDF | `📎` | Upload de material de apoio |
| Turnitin check | `🔍 %` | Analisa texto atual no editor |
| Export PDF | `⬇️ PDF` | Gera PDF ABNT do capítulo ativo |

Estilo toolbar: `text-xs text-slate-500 hover:text-white gap-4 flex items-center`

---

## 4. EDITOR CAPÍTULO (inline no chat)

O editor aparece como **card expandido** dentro do fluxo de chat quando o bot gera ou edita um capítulo.

```
┌─────────────────────────────────────────────────────┐
│  📄 Capítulo 1 — Introdução          [↗ Expand] [×] │
│  ─────────────────────────────────────────────────  │
│  [B] [I] [U] [H1] [H2] [Lista] [Citar ABNT]        │  ← mini toolbar
│  ─────────────────────────────────────────────────  │
│  Lorem ipsum introdução do tema, conforme           │
│  estabelecido por Silva (2023)...                   │
│  |                                                  │  ← cursor piscando
│  ─────────────────────────────────────────────────  │
│  Palavras: 487 / 800   Turnitin: 4%  [Salvar rascunho]│
└─────────────────────────────────────────────────────┘
```

| Elemento | Spec |
|---|---|
| Card | `bg-[#13131F] border border-white/10 rounded-2xl overflow-hidden` |
| Header card | `bg-white/4 px-4 py-2 flex items-center justify-between border-b border-white/5` |
| Mini toolbar | ícones `20px · text-slate-400 hover:text-white · gap-3` |
| Editor area | `contenteditable` ou integração `TipTap` · `min-height: 200px · p-4` |
| Rodapé | `text-xs text-slate-500 flex justify-between px-4 py-2 bg-white/2` |
| Turnitin inline | badge colorido: verde ≤ 10% · amarelo 11–25% · vermelho > 25% |
| `[Expand]` | Abre modal fullscreen para edição imersiva |

---

## 5. SIDEBAR DIREITA (250px)

```
  ┌─────────────────────┐
  │  📊 PROGRESSO TCC   │
  │  Cap 1 Intro ████░ 80% │
  │  Cap 2 Desenv ██░░░ 20% │
  │  Cap 3 Conc  ░░░░░  0% │
  │  Cap 4 Refs  ░░░░░  0% │
  │  ─────────────────  │
  │  📚 BIBLIOGRAFIA    │
  │  ≡ Silva, J. (2023) │
  │  ≡ Costa, M. (2022) │
  │  ≡ ABNT NBR (2024)  │
  │  [+ Adicionar ref]  │
  │  ─────────────────  │
  │  🔍 TURNITIN LIVE   │
  │  Atual: ████░ 4%    │
  │  Meta:  ≤ 10%       │
  │  [Ver relatório]    │
  └─────────────────────┘
```

### Progresso por capítulo

```css
/* Barra de progresso */
height: 6px; border-radius: 3px;
background: rgba(255,255,255,0.08);

.fill {
  background: linear-gradient(90deg, #7C3AED, #3B82F6);
  transition: width 600ms ease;
}
```

### Bibliografia (drag-drop)

- Lista `<ul>` com `drag-and-drop` para reordenar  
- Item: ícone `≡` (grip) · texto ABNT truncado · `×` para remover  
- `[+ Adicionar ref]` → abre modal de busca de referências

### Turnitin Live

- Porcentagem grande em gradiente brand  
- Barra circular ou linear animada  
- Atualiza a cada edição com debounce 2 s  
- Cores: `#22C55E` (≤10%) · `#F59E0B` (11–25%) · `#EF4444` (>25%)`

---

## Animações & Estados

| Elemento | Comportamento |
|---|---|
| **Sidebar collapse** | `translateX(-250px)` · toggle com `[☰]` · `transition 250ms ease` |
| **Chat stream** | Texto aparece token a token (typewriter effect) |
| **Editor card** | `fadeInUp 300ms` ao ser inserido no chat |
| **Progresso bars** | Animam ao montar com `transition: width 600ms` |
| **Turnitin badge** | Pulsa suavemente quando atualiza |
| **Hover refs** | `bg-white/5 rounded-md` · grip `opacity-0 → 1` |
| **Input focus** | Glow `box-shadow: 0 0 0 3px rgba(124,58,237,0.3)` |

---

## Responsividade

| Breakpoint | Comportamento |
|---|---|
| `> 1024px` | Layout completo 3 colunas |
| `768–1024px` | Sidebar direita oculta por padrão · botão `[📊]` abre como drawer |
| `< 768px` | Ambas sidebars viram drawers bottom-sheet · input sticky na base |

---

## Comandos de slash (input)

| Comando | Ação |
|---|---|
| `/novo-tcc` | Inicia nova conversa zerada |
| `/cap [n]` | Vai para edição do capítulo n |
| `/refs` | Lista referências bibliográficas |
| `/turnitin` | Roda verificação de plágio |
| `/export` | Gera PDF ABNT |

---

> **Próximo passo:** Especificar modal de Export PDF (prévia ABNT, opções: capítulo isolado ou TCC completo) ou modal de busca de referências bibliográficas reais.
