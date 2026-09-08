import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PROJECTS,
  validateOkanWebConfig
} from "../public/script/environment.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readArgument(name) {
  const directIndex = process.argv.indexOf(name);
  if (directIndex >= 0) return process.argv[directIndex + 1];

  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

async function readRawConfig() {
  const configPath = readArgument("--config");

  if (configPath) {
    return readFile(path.resolve(projectRoot, configPath), "utf8");
  }

  const inlineConfig = process.env.OKAN_WEB_CONFIG_JSON;
  if (!inlineConfig) {
    throw new Error(
      "Configuração ausente. Use --config <arquivo.local.json> ou OKAN_WEB_CONFIG_JSON."
    );
  }

  return inlineConfig;
}

function parseConfig(rawConfig) {
  try {
    return JSON.parse(rawConfig);
  } catch {
    throw new Error("OKAN_WEB_CONFIG_JSON não contém JSON válido.");
  }
}

function runtimeConfigSource(config) {
  return [
    "// Gerado por scripts/build-web.mjs. Não editar manualmente.",
    `export const okanWebConfig = Object.freeze(${JSON.stringify(config, null, 2)});`,
    ""
  ].join("\n");
}

async function configurePaymentSdk(targetDirectory, environment) {
  const dashboardPath = path.join(targetDirectory, "dashboard.html");
  const dashboard = await readFile(dashboardPath, "utf8");
  const paymentSdkMarker = "<!-- OKAN_PAYMENT_SDK -->";

  if (!dashboard.includes(paymentSdkMarker)) {
    throw new Error("Marcador esperado do SDK de pagamentos não foi encontrado.");
  }

  const paymentSdkTag = environment === "prod"
    ? '<script src="https://sdk.mercadopago.com/js/v2"></script>'
    : "<!-- SDK de pagamentos não incluído no artefato STAGING -->";

  await writeFile(
    dashboardPath,
    dashboard.replace(paymentSdkMarker, paymentSdkTag),
    "utf8"
  );
}

async function main() {
  const requestedEnvironment = readArgument("--env");

  if (!Object.hasOwn(EXPECTED_PROJECTS, requestedEnvironment)) {
    throw new Error(`Ambiente de build inválido: ${requestedEnvironment || "ausente"}.`);
  }

  const distRoot = path.join(projectRoot, "dist");
  const targetDirectory = path.join(distRoot, requestedEnvironment);

  if (!targetDirectory.startsWith(`${distRoot}${path.sep}`)) {
    throw new Error("Diretório de saída inválido.");
  }

  // Nunca preserve um artefato anterior quando o novo build falhar.
  // Isso impede que uma etapa de deploy posterior publique conteúdo obsoleto.
  await rm(targetDirectory, { recursive: true, force: true });

  const config = validateOkanWebConfig(
    parseConfig(await readRawConfig())
  );

  if (config.environment !== requestedEnvironment) {
    throw new Error(
      `Ambiente solicitado (${requestedEnvironment}) diverge da configuração (${config.environment}).`
    );
  }

  await mkdir(targetDirectory, { recursive: true });
  await cp(path.join(projectRoot, "public"), targetDirectory, {
    recursive: true
  });

  await writeFile(
    path.join(targetDirectory, "script", "runtime-config.js"),
    runtimeConfigSource(config),
    "utf8"
  );

  await configurePaymentSdk(targetDirectory, requestedEnvironment);

  await writeFile(
    path.join(targetDirectory, "okan-build-manifest.json"),
    `${JSON.stringify({
      environment: config.environment,
      projectId: config.firebase.projectId,
      externalPaymentsEnabled: config.payments.enabled,
      fixture: config.fixture
    }, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `[OKAN WEB] Build ${requestedEnvironment} criado em dist/${requestedEnvironment}.`
  );
}

await main();
