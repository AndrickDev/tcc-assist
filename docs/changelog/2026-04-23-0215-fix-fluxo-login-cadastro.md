---
data: 2026-04-23 02:15
titulo: Corrige fluxo de login e cadastro (email+senha visível, Google lado a lado)
categoria: fix
commit: 5344453
autor: Andrick
status: deployed
---

# Corrige fluxo de login e cadastro (email+senha visível, Google lado a lado)

## Resumo
A tela de login não estava deixando o usuário entrar com email e senha — ela redirecionava automaticamente para o Google assim que abria. Corrigimos: agora o formulário de email/senha aparece de cara, com o botão "Google" como alternativa abaixo. A tela de cadastro também passou a oferecer a opção "Continuar com Google".

## Motivação
Feedback direto do sócio: "clico em Entrar e vai direto pro Google, nem dá chance de colocar meu email e senha". O problema estava num `useEffect` na rota `/login` que chamava `signIn("google")` automaticamente a cada carregamento, a menos que o usuário fosse para `/login?mode=email` (query param que ninguém conhecia). Isso efetivamente escondia a opção de login por credenciais, mesmo ela estando disponível no backend. Para o aluno brasileiro de TCC, que muitas vezes não tem conta Google ativa ou prefere email institucional, isso era bloqueador.

Além disso, a tela de cadastro (`/register`) só aceitava email/senha — quem já tinha Google era obrigado a preencher manualmente. Alinhamos as duas telas para oferecerem os dois caminhos.

## O que mudou (técnico)
- `src/app/login/page.tsx` — removido o `useEffect` que chamava `signIn("google")` automaticamente. Removida a lógica de `?mode=email` e `shouldAutoGoogle`. A página agora renderiza, em toda chamada, o formulário de email+senha com `autoFocus` no campo de email, divider `"ou continue com"` e botão secundário "Google". Componente `GoogleIcon` extraído em local function para legibilidade. Mensagens de erro mais amigáveis: `"E-mail ou senha incorretos"` em vez de `"Credenciais inválidas"`.
- `src/app/register/page.tsx` — adicionada uma seção após o formulário de cadastro contendo divider `"ou cadastre-se com"` e o mesmo botão Google. Chama `signIn("google", { callbackUrl: "/dashboard" })` direto — o NextAuth com `PrismaAdapter` cria o usuário no banco na primeira passagem.
- Comportamento pós-cadastro preservado: após criar conta por email/senha, continua fazendo login automático e indo pra `/dashboard`.

## Como validar
Na Vercel, idealmente em aba anônima ou após deslogar:

1. Abrir `https://tcc-assist.vercel.app/`
2. Clicar em **Entrar** (não em "Experimente o Teseo")
3. Agora deve aparecer um formulário com **E-mail**, **Senha** e um botão **Entrar** no topo, e abaixo o botão **Google** como alternativa.
4. Testar entrar com email+senha já cadastrada — deve cair no `/dashboard`.
5. Testar entrar com credenciais erradas — deve aparecer "E-mail ou senha incorretos".
6. Voltar, clicar em **Google** — deve abrir o consentimento do Google como antes.
7. Em aba nova, ir pra `/register` (ou pelo link "Cadastre-se" no login).
8. Agora a tela de cadastro também tem botão **Google** abaixo do formulário.
9. Preencher o form normalmente — após criar, faz login e entra no dashboard como antes.

## Impacto
- **Usuário:** passa a ter o fluxo que o sócio pediu — login com email e senha visível de cara, Google opcional. Reduz fricção para usuários sem Google ativo e dá sensação de controle.
- **Segurança:** nenhuma alteração. Os dois providers (credentials e google) continuam funcionando como antes no `src/lib/auth.ts`.
- **Breaking change:** não. URLs `/login` e `/register` continuam funcionando. Quem tinha `/login?mode=email` bookmarkado vai cair na mesma tela (param ignorado).
- **Telemetria:** vale acompanhar se a proporção de logins por credentials vs google muda depois dessa entrega.

## Próximos passos
- Adicionar link "Esqueci minha senha" — hoje não existe fluxo de recuperação (já listado como débito pré-beta no status do projeto).
- Considerar um link "Voltar" mais visível quando o user está no `/login` mas já tem sessão (hoje cai no dashboard automaticamente graças ao redirect da landing, mas o /login em si não faz o mesmo check).

## Referências
- Commit: `5344453` (`git show 5344453`)
- Feedback do sócio: tela de login pulando direto pro Google sem mostrar campos de email/senha.
