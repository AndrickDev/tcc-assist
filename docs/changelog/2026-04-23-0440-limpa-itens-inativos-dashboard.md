---
data: 2026-04-23 04:40
titulo: Remove itens inativos do dashboard (sidebar e busca)
categoria: ui
commit: 90fead5
autor: Andrick
status: deployed
---

# Remove itens inativos do dashboard (sidebar e busca)

## Resumo
Limpamos dois elementos do dashboard que pareciam funcionais mas não faziam nada: o item "Referências" na barra lateral esquerda (só levava de volta pro próprio dashboard) e o campo "Buscar..." no topo (placeholder visual sem nenhuma ação ligada). Menos ruído, mais foco no que funciona.

## Motivação
Feedback direto do sócio: "retirar as referências do dashboard no menu lateral a esquerda e tirar o buscar lá em cima também". Ambos os elementos passavam a impressão de feature pronta mas não tinham comportamento. Para um beta fechado onde ele vai mostrar o produto ao sócio/possíveis clientes, manter elementos "mortos" passa uma imagem ruim.

A feature de Referências está implementada, mas dentro do **workspace** (drawer lateral no TCC), não no dashboard. O item no sidebar confundia: o usuário clicava esperando uma página de referências globais e voltava ao mesmo lugar.

## O que mudou (técnico)
- `src/components/AppSidebar.tsx` — removido o NAV item `{ icon: BookOpen, ..., label: "Referências" }` e o import não usado de `BookOpen`. Sidebar agora tem 3 itens (Dashboard, Projetos, Configurações) + ações fixas (tema, ajuda, sair).
- `src/app/dashboard/page.tsx` — removido o `<div>` com o span "Buscar..." no header do dashboard. Mantidos sino (notificações), badge do plano e botão "Novo TCC".

## Como validar
Após deploy:

1. Entrar em `/dashboard`
2. Passar o mouse pela sidebar esquerda — deve aparecer apenas: Dashboard, Projetos, Configurações
3. No topo do dashboard, o espaço à direita agora começa direto com o sino — sem o "Buscar..." antes dele

## Impacto
- **Usuário:** menos confusão, menos elementos "que não fazem nada".
- **Design:** header do dashboard fica mais respirável.
- **Breaking change:** não. Nada que já funcionava deixou de funcionar.
- **Débito:** o input de busca real do dashboard (filtrar TCCs por título) pode ser implementado depois como feature real, quando fizer sentido no produto.

## Referências
- Commit: `90fead5` (`git show 90fead5`)
