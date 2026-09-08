const EXPECTED_PROJECTS = Object.freeze({
  staging: "okan-staging-24829",
  prod: "app-academia-2914d"
});

const EXPECTED_APP_CHECK_PROVIDERS = Object.freeze({
  staging: "recaptcha_enterprise",
  prod: "recaptcha_v3"
});

const REQUIRED_FIREBASE_FIELDS = Object.freeze([
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
]);

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Configuração web inválida: ${field}.`);
  }

  return value;
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Configuração web ausente: ${field}.`);
  }

  return value.trim();
}

export function validateOkanWebConfig(input) {
  const config = requireObject(input, "raiz");
  const fixture = config.fixture === true;
  const environment = requireText(config.environment, "environment");

  if (!Object.hasOwn(EXPECTED_PROJECTS, environment)) {
    throw new Error(`Ambiente web não permitido: ${environment}.`);
  }

  const firebaseInput = requireObject(config.firebase, "firebase");
  const firebase = {};

  for (const field of REQUIRED_FIREBASE_FIELDS) {
    firebase[field] = requireText(firebaseInput[field], `firebase.${field}`);

    if (!fixture && /<[^>]+>|change[_-]?me|placeholder/i.test(firebase[field])) {
      throw new Error(`Configuração web contém placeholder: firebase.${field}.`);
    }
  }

  const expectedProjectId = EXPECTED_PROJECTS[environment];
  if (firebase.projectId !== expectedProjectId) {
    throw new Error(
      `Projeto Firebase inválido para ${environment}: ${firebase.projectId}.`
    );
  }

  const forbiddenProjectId = environment === "staging"
    ? EXPECTED_PROJECTS.prod
    : EXPECTED_PROJECTS.staging;

  if (JSON.stringify(config).includes(forbiddenProjectId)) {
    throw new Error(
      `A configuração de ${environment} contém referência ao projeto ${forbiddenProjectId}.`
    );
  }

  if (!firebase.appId.includes(`:${firebase.messagingSenderId}:web:`)) {
    throw new Error("firebase.appId não corresponde ao messagingSenderId.");
  }

  const appCheckInput = requireObject(config.appCheck, "appCheck");
  if (appCheckInput.enabled !== true) {
    throw new Error(`App Check deve estar habilitado em ${environment}.`);
  }

  const appCheckProvider = requireText(
    appCheckInput.provider,
    "appCheck.provider"
  );

  if (appCheckProvider !== EXPECTED_APP_CHECK_PROVIDERS[environment]) {
    throw new Error(
      `Provedor App Check inválido para ${environment}: ${appCheckProvider}.`
    );
  }

  const appCheck = Object.freeze({
    enabled: true,
    provider: appCheckProvider,
    siteKey: requireText(appCheckInput.siteKey, "appCheck.siteKey")
  });

  if (
    !fixture &&
    /<[^>]+>|change[_-]?me|placeholder/i.test(appCheck.siteKey)
  ) {
    throw new Error("Configuração web contém placeholder: appCheck.siteKey.");
  }

  const paymentsInput = requireObject(config.payments, "payments");
  const paymentsEnabled = paymentsInput.enabled === true;
  const publicKey = typeof paymentsInput.publicKey === "string"
    ? paymentsInput.publicKey.trim()
    : "";

  if (environment === "staging" && (paymentsEnabled || publicKey !== "")) {
    throw new Error("Pagamentos externos devem permanecer bloqueados em staging.");
  }

  if (environment === "prod" && (!paymentsEnabled || publicKey === "")) {
    throw new Error("Produção exige configuração explícita de pagamentos.");
  }

  return Object.freeze({
    environment,
    firebase: Object.freeze(firebase),
    appCheck,
    payments: Object.freeze({
      enabled: paymentsEnabled,
      publicKey
    }),
    fixture
  });
}

export function installEnvironmentBanner(config) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.okanEnvironment = config.environment;

  if (config.environment !== "staging") return;

  const render = () => {
    if (document.getElementById("okan-environment-banner")) return;

    const banner = document.createElement("div");
    banner.id = "okan-environment-banner";
    banner.className = "environment-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-label", "Ambiente de homologação");
    banner.textContent = "STAGING • DADOS SINTÉTICOS";
    document.body.appendChild(banner);
  };

  if (document.body) {
    render();
  } else {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  }
}

export { EXPECTED_APP_CHECK_PROVIDERS, EXPECTED_PROJECTS };
