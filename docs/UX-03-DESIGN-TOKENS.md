# UX-03 — Design tokens do painel web

## Objetivo

Compartilhar a linguagem visual canônica do aplicativo Flutter com o painel web sem alterar IDs, formulários, handlers JavaScript, Firebase ou regras de negócio.

## Primeira onda

A primeira onda centraliza no `:root` de `public/css/style.css`:

- cores de fundo, superfície, texto e borda;
- cores semânticas de ação, erro, aviso e informação;
- escalas de espaçamento e raios;
- sombras, família tipográfica e durações de movimento.

| Token | Valor | Uso principal |
|---|---|---|
| `--okan-color-background` | `#120E16` | fundo principal |
| `--okan-color-surface` | `#1E1826` | cartões, painéis e modais |
| `--okan-color-primary` | `#CCFF00` | ação principal, seleção e foco |
| `--okan-color-secondary` | `#E07A5F` | destaque secundário |
| `--okan-color-text-main` | `#F2F0F5` | texto principal |
| `--okan-color-text-sub` | `#9E9CAB` | texto complementar |
| `--okan-color-error` | `#FF453A` | falha ou ação destrutiva |
| `--okan-color-warning` | `#FFB020` | atenção sem bloqueio |
| `--okan-color-info` | `#448AFF` | informação e feedback neutro |

Os componentes CSS centrais foram migrados para `var(--okan-...)`. Cores inline em HTML ou geradas por JavaScript permanecem para ondas posteriores, permitindo revisão e rollback pequenos.

## Contratos preservados

- nenhum HTML ou JavaScript foi alterado;
- nenhum ID, `data-target`, formulário ou callback mudou;
- nenhum contrato Firebase, App Check, pagamento ou ambiente mudou;
- os breakpoints e a estrutura responsiva permanecem iguais;
- o botão Google mantém as cores próprias da marca.

## Verificação

```powershell
npm.cmd test
npm.cmd run build:staging:fixture
```

O artefato de fixture serve apenas para CI e é recusado pelo verificador de deploy. Após o merge, gerar o build com a configuração local real de STAGING, executar `npm.cmd run verify:staging` e cumprir o roteiro visual em login, cadastro e dashboard antes de considerar promoção para PROD.

## Rollback

Reverter a PR desta onda restaura a paleta anterior. Não há migração de dados nem mudança de configuração a desfazer.
