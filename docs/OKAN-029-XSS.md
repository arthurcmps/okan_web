# OKAN-029 — Hardening XSS do painel web

## Problema

Dados vindos do Firestore eram interpolados em `innerHTML`, permitindo que texto controlado por usuário pudesse ser interpretado como markup executável.

## Risco tratado

- execução de HTML/JavaScript injetado no painel administrativo;
- mensagens de toast ou confirmação interpretando markup arbitrário;
- regressões futuras em novos módulos que não estivessem em uma lista manual de arquivos.

## Comportamento preservado

- tabelas, modais, toasts e fluxos administrativos continuam com o mesmo contrato funcional;
- markup estático necessário à interface continua permitido;
- dados dinâmicos continuam visíveis, mas passam a ser tratados como texto ou escapados explicitamente.

## Novo comportamento

- mensagens de toast e confirmação usam DOM APIs e `textContent`;
- templates HTML que ainda recebem dados dinâmicos usam `escapeHtml()`;
- o skeleton é construído somente com DOM APIs;
- a suíte `test:xss` percorre recursivamente todo `public/script`, sem depender de uma lista manual de módulos;
- sinks perigosos como `insertAdjacentHTML`, `document.write`, `outerHTML`, incremento de `innerHTML` e atribuições dinâmicas não sanitizadas são bloqueados pelo teste.

## Dados existentes

Nenhuma migração de dados é necessária.

## Arquivos principais

- `public/script/dashboard.js`
- `public/script/modules/academia.js`
- `public/script/modules/feedbacks.js`
- `public/script/modules/loja.js`
- `public/script/modules/skeleton.js`
- `public/script/modules/toast.js`
- `public/script/utils/html.js`
- `test/xss_safety_test.mjs`
- `package.json`

## Validação local

```bash
npm run test:xss
node --check public/script/dashboard.js
node --check public/script/modules/academia.js
node --check public/script/modules/feedbacks.js
node --check public/script/modules/loja.js
node --check public/script/modules/skeleton.js
node --check public/script/modules/toast.js
```

Também executar as suítes web existentes antes de release:

```bash
npm run test:user-model
npm run test:academy-licenses
npm run test:academy-registration
npm run test:academy-billing
```

## Firebase Emulator

O OKAN-029 não altera regras, schema ou persistência Firebase. A validação principal é unitária/estática no frontend. As suítes de Rules permanecem como regressão geral do projeto.

## Risco para produção

Baixo. A mudança é de renderização do painel e não altera contratos de backend ou dados persistidos.

## Rollback

Reverter o merge do OKAN-029. Não há rollback de banco necessário.

## Critério de aceite

- [x] Campos dinâmicos não são interpretados como HTML arbitrário.
- [x] Toasts e confirmações usam DOM APIs/texto.
- [x] Conteúdo dinâmico em templates HTML usa escape explícito.
- [x] A auditoria XSS cobre automaticamente todos os scripts públicos.
- [x] Não há migração de dados.
