import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  EXPECTED_PROJECTS,
  validateOkanWebConfig
} from "../public/script/environment.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readEnvironmentArgument() {
  const index = process.argv.indexOf("--env");
  if (index >= 0) return process.argv[index + 1];

  const inline = process.argv.find((value) => value.startsWith("--env="));
  return inline ? inline.slice("--env=".length) : null;
}

async function main() {
  const environment = readEnvironmentArgument();

  if (!Object.hasOwn(EXPECTED_PROJECTS, environment)) {
    throw new Error(`Ambiente de verificação inválido: ${environment || "ausente"}.`);
  }

  const targetDirectory = path.join(projectRoot, "dist", environment);
  const manifest = JSON.parse(
    await readFile(
      path.join(targetDirectory, "okan-build-manifest.json"),
      "utf8"
    )
  );

  if (manifest.environment !== environment) {
    throw new Error("Manifesto e ambiente solicitado divergem.");
  }

  if (manifest.projectId !== EXPECTED_PROJECTS[environment]) {
    throw new Error("Manifesto aponta para projeto Firebase inesperado.");
  }

  if (manifest.fixture === true) {
    throw new Error("Artefato de fixture nunca pode ser implantado.");
  }

  const runtimeConfigPath = path.join(
    targetDirectory,
    "script",
    "runtime-config.js"
  );
  const runtimeConfig = await readFile(runtimeConfigPath, "utf8");
  const runtimeModule = await import(
    `${pathToFileURL(runtimeConfigPath).href}?verify=${Date.now()}`
  );
  const validatedConfig = validateOkanWebConfig(runtimeModule.okanWebConfig);

  if (
    validatedConfig.environment !== environment ||
    validatedConfig.firebase.projectId !== EXPECTED_PROJECTS[environment]
  ) {
    throw new Error("Configuração executável aponta para ambiente inesperado.");
  }

  if (
    manifest.externalPaymentsEnabled !== validatedConfig.payments.enabled ||
    manifest.fixture !== validatedConfig.fixture
  ) {
    throw new Error("Manifesto diverge da configuração executável.");
  }

  const dashboard = await readFile(
    path.join(targetDirectory, "dashboard.html"),
    "utf8"
  );

  if (dashboard.includes("OKAN_PAYMENT_SDK")) {
    throw new Error("Artefato contém marcador de build não resolvido.");
  }

  if (environment === "staging") {
    if (manifest.externalPaymentsEnabled !== false) {
      throw new Error("Artefato STAGING habilitou pagamentos externos.");
    }

    if (runtimeConfig.includes(EXPECTED_PROJECTS.prod)) {
      throw new Error("Artefato STAGING contém referência ao projeto PROD.");
    }

    if (/sdk\.mercadopago\.com|APP_USR-/.test(dashboard + runtimeConfig)) {
      throw new Error("Artefato STAGING contém configuração do Mercado Pago.");
    }
  }

  if (environment === "prod") {
    if (manifest.externalPaymentsEnabled !== true) {
      throw new Error("Artefato PROD não habilitou pagamentos explicitamente.");
    }

    if (!dashboard.includes("https://sdk.mercadopago.com/js/v2")) {
      throw new Error("Artefato PROD não contém o SDK de pagamentos esperado.");
    }
  }

  console.log(
    `[OKAN WEB] Artefato ${environment} aprovado para deploy explícito.`
  );
}

await main();
