# TCC-ASSIST — Auth Screens Spec
> **Referência:** Dribbble "Minimal Auth Flow 2026"  
> **Paleta:** reutiliza tokens de `landing.md` — `#0F0F1A` bg · `#7C3AED → #3B82F6` gradiente · glassmorphism  
> **Tipografia:** Inter (mesma do landing)  
> **Princípios:** Mobile-first · Mobile keyboard-friendly · Dark mode padrão

---

## Layout base (compartilhado nas 3 telas)

```
┌─────────────────────────────┐
│  [fundo gradiente radial]   │
│                             │
│  ┌──────────────────────┐   │
│  │  [card glassmorphism]│   │
│  │   Logo + conteúdo    │   │
│  └──────────────────────┘   │
│                             │
└─────────────────────────────┘
```

```css
/* Fundo da página */
min-height: 100dvh;                               /* respeita teclado mobile */
background: radial-gradient(ellipse at top, #1e1b4b 0%, #0f0f1a 70%);
display: grid;
place-items: center;
padding: 1rem;

/* Card central */
width: min(440px, 100%);
background: rgba(255,255,255,0.05);
border: 1px solid rgba(255,255,255,0.10);
backdrop-filter: blur(12px);
border-radius: 1.5rem;                            /* 24px */
padding: 2.5rem 2rem;                             /* compacta em mobile */
box-shadow: 0 20px 60px rgba(124, 58, 237, 0.15);
```

---

## Tela 1 — Login

```
        ✦ TCC-ASSIST
   "Bem-vindo de volta"
   ───────────────────

   [ email@exemplo.com      ]   ← input
   [ ••••••••••        👁  ]   ← senha + eye toggle

       [ Entrar → ]             ← botão gradiente

   Esqueceu senha?  |  Criar conta
```

### Campos

| Campo | Tipo | Placeholder | Validação |
|---|---|---|---|
| Email | `email` | `email@exemplo.com` | formato válido |
| Senha | `password` · toggle `👁` | `••••••••` | mín. 8 chars |

### Botão `[Entrar →]`

```css
width: 100%;
padding: 0.875rem;
background: linear-gradient(135deg, #7C3AED, #3B82F6);
border-radius: 0.75rem;
font-weight: 700;
letter-spacing: 0.02em;
transition: opacity 200ms, transform 200ms;

&:hover  { opacity: 0.90; transform: translateY(-1px); }
&:active { transform: scale(0.98); }
```

### Links inferiores

```
text-sm · color: #94A3B8
"Esqueceu senha?"  →  /auth/reset   (hover: text-white)
"Criar conta"      →  /auth/signup  (hover: text-purple-400)
```

---

## Tela 2 — Cadastro

```
        ✦ TCC-ASSIST
   "Comece seu TCC hoje"
   ─────────────────────

   [ Nome completo          ]
   [ email@exemplo.com      ]
   [ Senha (mín. 8 chars)   ]
   [ Confirmar senha        ]
   [ WhatsApp (opcional)    ]

     [ Criar conta grátis → ]

   ──────── ou ────────

   [G]  Continuar com Google

   Já tem conta?  Entrar
```

### Campos

| Campo | Tipo | Obrigatório | Note |
|---|---|---|---|
| Nome completo | `text` | ✅ | `autocomplete="name"` |
| Email | `email` | ✅ | `autocomplete="email"` |
| Senha | `password` + eye | ✅ | strength meter (fraco/médio/forte) |
| Confirmar senha | `password` + eye | ✅ | match validation inline |
| WhatsApp | `tel` | ❌ | label `opcional` · `autocomplete="tel"` |

### Strength meter (senha)

```
Fraco   ████░░░░  cor: #EF4444
Médio   ████████░░  cor: #F59E0B
Forte   ████████████  cor: #22C55E
```
Barra `height: 3px · border-radius: 2px` embaixo do input de senha.

### Botão Google OAuth

```css
width: 100%;
padding: 0.75rem;
background: rgba(255,255,255,0.08);
border: 1px solid rgba(255,255,255,0.15);
border-radius: 0.75rem;
display: flex; align-items: center; gap: 0.75rem;
color: #F1F5F9; font-weight: 500;

&:hover { background: rgba(255,255,255,0.12); }
```

Ícone Google SVG colorido (`18px`) + texto `"Continuar com Google"`.

---

## Tela 3 — Verificação de email

```
        ✦ TCC-ASSIST

          ✉️  (ícone grande animado)

   "Confirme seu email"

   "Enviamos um link para
    email@exemplo.com"

        ◌  [carregando...]          ← spinner enquanto aguarda
   ou
        [ Reenviar email ]          ← após 30s

   ← Voltar para login
```

### Estados

| Estado | UI |
|---|---|
| **Aguardando** (0–30 s) | Spinner `@keyframes spin` centralizado · botão "Reenviar" desabilitado com countdown `(30s)` |
| **Pode reenviar** (> 30 s) | Botão "Reenviar email" habilitado · borda `border-purple-500` |
| **Reenviado** | Toast `"Email enviado!"` · countdown reinicia |
| **Confirmado** (webhook) | Redirect automático → `/dashboard` com fade |

### Spinner

```css
width: 40px; height: 40px;
border: 3px solid rgba(124, 58, 237, 0.2);
border-top-color: #7C3AED;
border-radius: 50%;
animation: spin 800ms linear infinite;
```

---

## Animações & Micro-interações

| Elemento | Comportamento |
|---|---|
| **Input focus glow** | `box-shadow: 0 0 0 3px rgba(124,58,237,0.35)` · `border-color: #7C3AED` · `transition 150ms` |
| **Button pulse** | `@keyframes pulse-ring` sutil no CTA principal ao renderizar |
| **Slide transitions** | Tela → tela: `translateX(+20px) → 0 + opacity 0 → 1` · duração 250 ms |
| **Eye toggle** | Ícone troca `EyeOff ↔ Eye` · `transition-opacity 100ms` |
| **Strength meter** | Largura animada `transition: width 300ms ease` |
| **Ícone email (tela 3)** | `@keyframes float` sutil (±6 px vertical, 3 s loop) |
| **Toast** | Slide in do topo · auto-dismiss 3 s |

---

## Input base (todos os campos)

```css
width: 100%;
padding: 0.75rem 1rem;
background: rgba(255,255,255,0.06);
border: 1px solid rgba(255,255,255,0.12);
border-radius: 0.625rem;
color: #F1F5F9;
font-size: 0.9375rem;            /* 15px — confortável em mobile */
outline: none;
transition: border-color 150ms, box-shadow 150ms;

&::placeholder { color: #475569; }

&:focus {
  border-color: #7C3AED;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.30);
}

&.error {
  border-color: #EF4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.20);
}
```

---

## Acessibilidade & Mobile keyboard

- Todos os `<input>` têm `id` + `<label>` explícito (ou `aria-label`)  
- `autocomplete` configurado por campo (ver tabela Tela 2)  
- `inputmode="email"` no campo email · `inputmode="tel"` no WhatsApp  
- Botão submit: `type="submit"` · spinner interno ao `loading` (evita double-submit)  
- Foco visível: `outline` substituído pelo glow customizado acima  
- Contraste mínimo AA: `#94A3B8` em `#0F0F1A` ≥ 4.5:1

---

## Rotas

| Tela | Rota |
|---|---|
| Login | `/auth/login` |
| Cadastro | `/auth/signup` |
| Verificação | `/auth/verify-email` |
| Reset senha | `/auth/reset` *(fora do escopo desta spec)* |

---

> **Próximo passo:** Implementar em componentes reutilizáveis (`AuthCard`, `InputField`, `GradientButton`) ou exportar para Figma com auto-layout e tokens vinculados.
