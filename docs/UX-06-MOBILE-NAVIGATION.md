# UX-06 - Navegação móvel do dashboard

## Escopo

Esta onda conclui a arquitetura básica do menu móvel sem alterar autenticação,
RBAC, Firebase, dados, pagamentos ou handlers das seções.

No desktop, a barra lateral permanece inalterada. Abaixo de 768 px, o super
admin vê quatro destinos primários - Início, Academias, Professores e Loja - e
o controle Mais. Feedback Beta e Sair ficam no painel Mais. O gestor de
academia continua vendo somente Minha Academia e Assinatura; Sair permanece em
Mais.

Os IDs `menu-*`, os atributos `data-target`, o `logout-btn` e as seções
canônicas continuam sendo a fonte de verdade. As ações do painel Mais apenas
delegam cliques a esses controles existentes.

## Testes automatizados

```powershell
npm.cmd test
npm.cmd run build:staging:fixture
```

O artefato fixture deve ser recusado por `verify:staging`, pois nunca pode ser
implantado. Para o smoke autenticado, gerar o build com a configuração real e
somente então verificá-lo:

```powershell
npm.cmd run build:staging
npm.cmd run verify:staging
```

## Roteiro manual em STAGING

1. Entre como super admin em uma janela de até 360 px.
2. Confirme quatro destinos primários e o botão Mais, sem rolagem horizontal.
3. Abra Mais, acesse Feedback Beta e confirme título, conteúdo e estado ativo.
4. Reabra Mais e confirme que Sair executa o logout existente.
5. Repita com teclado usando Tab, Enter, Espaço e Escape.
6. Entre como gestor e confirme apenas Minha Academia, Assinatura e Mais.
7. Verifique que nenhuma seção não autorizada aparece no painel Mais.
8. Repita em 1366 x 768 e confirme a barra lateral desktop sem regressão.
9. Confirme que menu, conteúdo e toasts não se sobrepõem em 360 px.

Usar somente contas e dados sintéticos. Não promover esta onda para PROD antes
do smoke autenticado em STAGING.
