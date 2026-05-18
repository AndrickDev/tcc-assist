# B6 Authorization Smoke

Smoke manual para validar que rotas de `/api/tcc/[id]/**` não expõem TCCs entre usuários.

## Setup

Use um `tccId` pertencente ao userA e chame as rotas com cookie de sessão do userB.

```bash
BASE_URL="http://localhost:3000"
TCC_ID_A="tcc_id_do_userA"
MESSAGE_ID_A="message_id_do_tcc_do_userA"
ATTACHMENT_ID_A="attachment_id_do_tcc_do_userA"
REF_ID_A="reference_id_do_tcc_do_userA"
COOKIE_USER_B='authjs.session-token=cole_o_cookie_do_userB'
```

Resultado esperado em todos os comandos abaixo: HTTP `404` (não `200`, não `403`, não `500`).

| Método | Rota | Esperado | Cmd |
|---|---|---|---|
| GET | `/api/tcc/[id]` | 404 | `curl -i -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A"` |
| PUT | `/api/tcc/[id]` | 404 | `curl -i -X PUT -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"title":"intruso"}' "$BASE_URL/api/tcc/$TCC_ID_A"` |
| DELETE | `/api/tcc/[id]` | 404 | `curl -i -X DELETE -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A"` |
| GET | `/api/tcc/[id]/messages` | 404 | `curl -i -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/messages"` |
| POST | `/api/tcc/[id]/messages` | 404 | `curl -i -X POST -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"content":"teste intruso"}' "$BASE_URL/api/tcc/$TCC_ID_A/messages"` |
| DELETE | `/api/tcc/[id]/messages/[messageId]` | 404 | `curl -i -X DELETE -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/messages/$MESSAGE_ID_A"` |
| PUT | `/api/tcc/[id]/content` | 404 | `curl -i -X PUT -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"content":"<p>intruso</p>"}' "$BASE_URL/api/tcc/$TCC_ID_A/content"` |
| POST | `/api/tcc/[id]/ai-action` | 404 | `curl -i -X POST -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"action":"review","text":"teste"}' "$BASE_URL/api/tcc/$TCC_ID_A/ai-action"` |
| GET | `/api/tcc/[id]/attachments` | 404 | `curl -i -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/attachments"` |
| POST | `/api/tcc/[id]/attachments` | 404 | `curl -i -X POST -H "Cookie: $COOKIE_USER_B" -F "file=@./fixtures/teste.pdf" "$BASE_URL/api/tcc/$TCC_ID_A/attachments"` |
| GET | `/api/tcc/[id]/stats` | 404 | `curl -i -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/stats"` |
| GET | `/api/tcc/[id]/references` | 404 | `curl -i -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/references"` |
| DELETE | `/api/tcc/[id]/references` | 404 | `curl -i -X DELETE -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/references"` |
| PATCH | `/api/tcc/[id]/references/[refId]` | 404 | `curl -i -X PATCH -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"favorited":true}' "$BASE_URL/api/tcc/$TCC_ID_A/references/$REF_ID_A"` |
| DELETE | `/api/tcc/[id]/references/[refId]` | 404 | `curl -i -X DELETE -H "Cookie: $COOKIE_USER_B" "$BASE_URL/api/tcc/$TCC_ID_A/references/$REF_ID_A"` |
| POST | `/api/tcc/[id]/references/search` | 404 | `curl -i -X POST -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"query":"machine learning"}' "$BASE_URL/api/tcc/$TCC_ID_A/references/search"` |
| POST | `/api/tcc/[id]/references/compare` | 404 | `curl -i -X POST -H "Cookie: $COOKIE_USER_B" -H "Content-Type: application/json" -d '{"referenceIds":["'$REF_ID_A'"]}' "$BASE_URL/api/tcc/$TCC_ID_A/references/compare"` |
| POST | `/api/tcc/[id]/image` | 404 | `curl -i -X POST -H "Cookie: $COOKIE_USER_B" -F "file=@./fixtures/teste.png" "$BASE_URL/api/tcc/$TCC_ID_A/image"` |

Observação: se o ambiente usa cookie seguro, o nome pode ser `__Secure-authjs.session-token`; nesse caso, ajuste `COOKIE_USER_B`.
