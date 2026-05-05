# ADR-0006 — JWT interno Next ↔ FastAPI

- **Status:** Aceito
- **Data:** 2026-05-02
- **Decisor:** Andrick (solo dev)
- **Tags:** arquitetura, auth, jwt, seguranca

---

## Contexto

Pela ADR-0001, o Next.js chama o FastAPI em todas as rotas de IA: `chat`, `generate` e `action`.
Pela ADR-0005, o FastAPI também expõe `GET /v1/quota/me` para consulta de quota. O FastAPI nunca é
exposto diretamente ao browser; o browser continua falando apenas com o Next.

Precisamos provar ao FastAPI:

- Identidade do usuário (`userId`).
- Plano efetivo (`FREE`, `PRO`, `VIP`).
- TCC alvo quando a operação depende de um TCC.
- Escopo da chamada, para que um token de `chat` não invoque `generate`.

O FastAPI não deve consultar o banco em toda chamada só para resolver identidade e plano: isso
adiciona latência e acopla a camada de IA ao schema de produto. O Next já autentica o usuário via
NextAuth v5, mas a sessão do NextAuth é acoplada ao domínio web: cookie, callbacks e secret próprios.
Repassar o cookie do browser para outro serviço tornaria o FastAPI dependente dos detalhes internos
do NextAuth e do domínio do Next.

## Decisão

Usar **JWT HS256 assinado com `INTERNAL_JWT_SECRET`**, compartilhado entre Next.js e FastAPI.

O token é emitido pelo Next, usado uma única vez no hop Next -> FastAPI e enviado no header:

```http
Authorization: Bearer <jwt>
```

**Claims obrigatórios:**

- `sub`: `userId` vindo de `session.user.id` no Next.
- `plan`: `"FREE" | "PRO" | "VIP"`.
- `scope`: `"chat" | "generate" | "action" | "quota"`.
- `iat`: epoch seconds.
- `exp`: `iat + 60` segundos.
- `iss`: `"tcc-assist-web"`.
- `aud`: `"tcc-assist-ai"`.

**Claim opcional:**

- `tccId`: presente quando o escopo exige um TCC específico (`chat`, `generate`, `action`). Ausente
  em `scope = quota`, que consulta saldo do usuário e não depende de um TCC.

**Exemplo de header e claims:**

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "claims": {
    "sub": "user_cuid_123",
    "plan": "PRO",
    "scope": "chat",
    "tccId": "tcc_cuid_456",
    "iat": 1777737600,
    "exp": 1777737660,
    "iss": "tcc-assist-web",
    "aud": "tcc-assist-ai"
  }
}
```

HS256 é suficiente porque os dois serviços têm o mesmo dono operacional. RS256 não traz ganho real
neste estágio e adiciona gestão de chave assimétrica.

Bibliotecas:

- Next-side: `jose`, já usado no ecossistema do NextAuth e evita dependência nova.
- FastAPI-side: `python-jose` ou `pyjwt`; decisão fica como TBD da tarefa de implementação.

## Validação no FastAPI

Toda rota exige JWT válido, exceto `GET /v1/health`.

Validações obrigatórias:

- Assinatura válida com `INTERNAL_JWT_SECRET`.
- `alg = HS256`; rejeitar `alg = none` ou qualquer outro algoritmo.
- `iss = "tcc-assist-web"`.
- `aud = "tcc-assist-ai"`.
- `exp` ainda não expirou.
- `scope` corresponde à rota chamada:
  - `scope = chat` vale para `POST /v1/chat`.
  - `scope = generate` vale para `POST /v1/generate`.
  - `scope = action` vale para `POST /v1/actions/{action}`.
  - `scope = quota` vale para `GET /v1/quota/me`.
- `tccId` obrigatório para `chat`, `generate` e `action`; ausente ou ignorado em `quota`.

Falha em qualquer validação:

```json
{"error": "invalid_token", "detail": "<motivo curto>"}
```

Sem header `Authorization`:

```json
{"error": "missing_token"}
```

Ambos retornam HTTP 401.

## Rotação de chave

`INTERNAL_JWT_SECRET` é rotacionado via deploy coordenado dos dois serviços.

Suporte a duas chaves ativas (`current` + `previous`) durante janela de rotação fica como TBD. Deve
ser implementado somente quando rotação for necessária.

Gatilhos para implementar suporte a duas chaves:

- Suspeita de comprometimento ou vazamento.
- A cada 12 meses de operação contínua.

Clock skew tolerado: 5 segundos, como margem para diferença de NTP entre hosts.

## Consequências

### Positivas
- FastAPI valida identidade e escopo de forma stateless, normalmente sub-1ms.
- Segurança equivalente ao fluxo de sessão do Next para o hop interno de IA.
- Isola a lógica de auth do NextAuth do serviço FastAPI.
- Cada chamada ao FastAPI fica auditável por `sub`, `plan`, `scope`, `tccId`, `iss` e `aud` nos logs.

### Negativas
- Chave compartilhada exige secret manager; nunca deve ir para o repositório.
- Expiração curta exige clock sync confiável nos hosts.
- Rotação sem suporte a duas chaves pode exigir deploy coordenado e curta janela operacional.

### Neutras
- O browser nunca vê esses tokens.
- Tokens são gerados e consumidos somente entre Next e FastAPI.
- O JWT interno não substitui NextAuth; ele apenas traduz a sessão autenticada para o hop interno.

## Comportamento em casos limite

- Token expira durante request longo da Gemini: aceitável. O token cobre apenas a entrada da chamada
  no FastAPI; a chamada subsequente para Gemini não depende dele.
- `jti` para evitar replay: opcional. Implementar somente se houver suspeita de replay. Sem `jti`,
  `exp` curto, `aud` e `iss` já mitigam reuso indevido.
- Usuário faz upgrade depois do token ser emitido: o próximo token reflete o plano novo. Expiração de
  60 segundos garante atualização rápida.

## Alternativas consideradas

**A. mTLS entre Next e FastAPI.**
Rejeitada. Overhead de certificado, renovação e configuração é desproporcional para dois serviços do
mesmo dono neste estágio.

**B. API key estática no header.**
Rejeitada. Não expira e não carrega identidade do usuário, plano, TCC ou escopo. Vazamento exige
rotação manual urgente.

**C. Repassar cookie de sessão do NextAuth.**
Rejeitada. Acopla o FastAPI ao domínio web do Next, callbacks e formato interno do NextAuth.
Cross-origin exigiria proxy adicional e a sessão do NextAuth não foi desenhada para ser consumida
por outro serviço.

**D. JWT RS256 com chave assimétrica.**
Rejeitada agora. Como os dois serviços têm o mesmo dono, a complexidade adicional não se justifica.
Reavaliar se entrar um terceiro serviço interno, como billing próprio.

**E. OAuth2 client credentials interno.**
Rejeitada. Para dois serviços do mesmo dono, é overkill e reimplementaria o mesmo problema com mais
peças operacionais.

## Notas de implementação

- FastAPI: criar `services/ai/app/api/auth.py`.
  - Dependency: `verify_internal_jwt(scope: str)`.
  - Usar a dependency em todas as rotas exceto `GET /v1/health`.
- Next: criar `apps/web/src/lib/internal-jwt.ts`.
  - Função `signInternalJwt(payload)` usando `jose`.
  - Chamada pelos handlers que falam com FastAPI.
- `.env.example` dos dois workspaces deve incluir `INTERNAL_JWT_SECRET=change-me`.
- Documentar geração de segredo: `openssl rand -base64 32`.
- `GET /v1/health` continua sem JWT para healthcheck de container e do provedor FastAPI
  (Fly.io/Render/Railway).

## Gatilhos pra reavaliar

- Adição de um terceiro serviço interno: avaliar JWT RS256 ou service mesh.
- Necessidade de tokens com escopo mais granular, como por `tcc_id` específico com TTL longo:
  considerar JWE e/ou claim `jti` com cache em Redis.
- Comprometimento ou suspeita de leak: rotação imediata de `INTERNAL_JWT_SECRET` e suporte temporário
  a duas chaves.

## Referências

- ADR-0001 — Comunicação Next ↔ FastAPI por HTTP definida.
- ADR-0005 — `GET /v1/quota/me` consome este JWT.
- ADR-0007 — Monorepo permite que `apps/web` e `services/ai` compartilhem secrets gerenciados.

