# UX-04 — Login e cadastro web

## Objetivo

Melhorar a clareza, a identidade e a acessibilidade das telas públicas de autenticação sem alterar os contratos de login, cadastro ou Firebase.

## Primeira fatia

- nome orientado ao cliente: **Okan para Academias**;
- frase curta de valor nas duas telas;
- campos, IDs e submits existentes preservados;
- mostrar/ocultar senha com botão nativo e `aria-label`;
- controles independentes para senha e confirmação;
- feedback com região viva e altura reservada;
- estados ocupados expostos por `aria-busy`;
- labels associados aos campos do cadastro;
- link para a Política de Privacidade existente;
- login Google preservado conforme o comportamento atual.

## Itens deliberadamente adiados

- logo oficial: depende de incorporar ao repositório web um asset otimizado e versionado;
- Termos de Uso: depende da aprovação do texto jurídico;
- alterações no conteúdo da Política de Privacidade;
- qualquer mudança nos métodos de autenticação, User v2 ou cadastro B2B.

## Contratos preservados

- `login-form`, `email`, `password`, `login-btn` e `google-login-btn`;
- `register-form`, todos os campos `reg-*` e `register-btn`;
- `signInWithEmailAndPassword`, `signInWithPopup` e recuperação de senha;
- `createUserWithEmailAndPassword` e Callable `registerAcademy`;
- redirects, ambientes, App Check, pagamentos e regras de autorização.

## Validação obrigatória antes do merge

1. executar a suíte completa;
2. gerar e verificar o artefato STAGING;
3. publicar somente no target `hosting:staging`;
4. testar login por e-mail, erro de credencial e recuperação de senha;
5. testar mostrar/ocultar senha nas duas páginas;
6. conferir cadastro sem criar dados duplicados;
7. testar teclado, foco visível e largura móvel;
8. confirmar ausência de valores digitados nos logs;
9. confirmar pagamentos bloqueados e nenhuma alteração em PROD.

## Risco e rollback

Risco baixo, concentrado em apresentação e controles locais. O rollback consiste em reverter a PR; não há migração de dados.
