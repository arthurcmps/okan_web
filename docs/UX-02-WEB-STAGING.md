# UX-02 — STAGING seguro para o painel web

## 1. Objetivo

Separar o artefato do painel web por ambiente e impedir que testes de PR, homologação ou configuração incompleta alcancem silenciosamente o Firebase de produção.

## 2. Projetos e targets permitidos

| Ambiente | Project ID | Hosting target | Pagamentos externos |
|---|---|---|---|
| STAGING | `okan-staging-24829` | `staging` | bloqueados |
| PROD | `app-academia-2914d` | `prod` | exigem configuração explícita |

Não existe alias `default`. Todo build e deploy precisa nomear o ambiente e o projeto.

## 3. Controles fail-closed

O build é interrompido quando:

- `--env` está ausente ou possui valor desconhecido;
- o ambiente solicitado diverge do JSON de configuração;
- o project ID não corresponde ao ambiente;
- STAGING contém qualquer referência ao project ID de PROD;
- algum campo Firebase ou App Check está ausente;
- STAGING não usa `recaptcha_enterprise` ou PROD deixa de usar o provedor v3 atualmente implantado;
- uma configuração real contém placeholder;
- App Check está desabilitado;
- STAGING habilita pagamentos ou contém chave pública do provedor;
- PROD não habilita pagamentos explicitamente.

O deploy é interrompido quando:

- o manifesto aponta para ambiente ou projeto inesperado;
- o artefato foi gerado com fixture de teste;
- o artefato STAGING contém SDK/configuração do Mercado Pago;
- o artefato STAGING contém referência ao projeto PROD.

## 4. Estrutura de build

O diretório `public/` virou código-fonte e não deve ser implantado diretamente.

```text
public/                     fonte sem configuração executável
config/*.example.json       modelos sem credenciais operacionais
config/*.local.json         configuração local ignorada pelo Git
dist/staging/               artefato STAGING gerado
dist/prod/                  artefato PROD gerado
```

`public/script/runtime-config.js` contém somente uma configuração nula. O build substitui esse arquivo dentro de `dist/<ambiente>`. O fonte também contém apenas um marcador para o SDK de pagamentos: o build o mantém ausente em STAGING e o insere somente em PROD. Portanto, servir ou implantar `public/` diretamente falha antes de inicializar o Firebase e não carrega o provedor de pagamentos.

## 5. Obter a configuração do aplicativo web STAGING

O aplicativo web registrado em STAGING possui o ID:

```text
1:993246251446:web:829ca869de1d79f3cf1917
```

No PowerShell, com Firebase CLI autenticado:

```powershell
firebase.cmd apps:sdkconfig WEB `
  1:993246251446:web:829ca869de1d79f3cf1917 `
  --project okan-staging-24829
```

No Google Cloud Console do projeto `okan-staging-24829`, criar uma chave Web baseada em pontuação do reCAPTCHA Enterprise. Autorizar somente os domínios:

```text
okan-staging-24829.web.app
okan-staging-24829.firebaseapp.com
```

Não autorizar `localhost` nessa chave implantável. No Firebase Console, registrar o aplicativo em App Check com o provedor **reCAPTCHA Enterprise** e a mesma chave. A chave de site é pública, mas deve permanecer no arquivo de ambiente para evitar mistura entre projetos.

PROD continua temporariamente com `recaptcha_v3`, preservando a configuração já implantada. Sua migração para Enterprise deve ocorrer em mudança separada, com métricas e rollback próprios.

## 6. Criar a configuração local

```powershell
Copy-Item `
  .\config\okan-web.staging.example.json `
  .\config\okan-web.staging.local.json

notepad .\config\okan-web.staging.local.json
```

Preencher `apiKey` e `appCheck.siteKey` com os valores do projeto STAGING. Confirmar que:

```json
"environment": "staging"
"projectId": "okan-staging-24829"
"appCheck": { "enabled": true, "provider": "recaptcha_enterprise" }
"payments": { "enabled": false, "publicKey": "" }
```

O arquivo `*.local.json` é ignorado pelo Git e nunca deve ser enviado ao repositório.

## 7. Gerar e validar o artefato

```powershell
npm.cmd ci
npm.cmd test

npm.cmd run build:staging -- `
  --config .\config\okan-web.staging.local.json

npm.cmd run verify:staging
```

Resultado esperado:

- build em `dist/staging`;
- project ID `okan-staging-24829` no manifesto;
- banner `STAGING • DADOS SINTÉTICOS` em todas as páginas que inicializam Firebase;
- botão de pagamento desabilitado;
- SDK do Mercado Pago ausente do HTML gerado;
- verificação de deploy aprovada.

## 8. Deploy manual em STAGING

STAGING utiliza o canal `live` do projeto isolado, não o canal de produção. Isso mantém uma URL estável para configurar App Check:

```text
https://okan-staging-24829.web.app
```

Antes do primeiro teste, cadastrar esse domínio na chave reCAPTCHA Enterprise e no App Check de STAGING.

```powershell
firebase.cmd deploy `
  --project okan-staging-24829 `
  --only hosting:staging
```

Nunca substituir o project ID por PROD. O site usa recursos reais do projeto STAGING; portanto, somente dados sintéticos podem ser usados.

## 9. GitHub Actions

- PRs executam testes e um build com fixture, sem deploy;
- deploy STAGING é manual e exige o secret `FIREBASE_SERVICE_ACCOUNT_OKAN_STAGING_24829`;
- o JSON real do cliente STAGING fica no secret `OKAN_WEB_STAGING_CONFIG_JSON`;
- deploy PROD é manual, exige confirmação e secrets próprios;
- nenhum workflow de PR usa service account ou project ID de PROD.

## 10. Validação manual obrigatória

1. confirmar o banner STAGING;
2. abrir login, cadastro e dashboard em 360 px e desktop;
3. autenticar apenas usuário sintético de STAGING;
4. conferir no Firebase Console que o usuário pertence a `okan-staging-24829`;
5. validar academias, professores, templates, feedback e modais;
6. confirmar que pagamento está desabilitado;
7. confirmar ausência de erros de App Check;
8. confirmar que nenhum dado de PROD aparece.

## 11. Estado e pendências

Implementação local e testes automatizados podem ser concluídos sem valores reais. UX-02 somente muda para `done` depois de:

- configurar os dois secrets no GitHub;
- habilitar Hosting e App Check no projeto STAGING;
- publicar manualmente no target `staging` do projeto isolado;
- concluir o roteiro autenticado com dados sintéticos;
- registrar a URL e o SHA validados sem incluir credenciais.

## 12. Rollback

Se o deploy STAGING falhar, interromper os testes e restaurar a versão anterior no Hosting do projeto `okan-staging-24829`. O site PROD não é alterado. Para rollback do código, reverter a PR da UX-02; nenhum dado é migrado.
