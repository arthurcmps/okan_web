import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_APP_CHECK_PROVIDERS,
  EXPECTED_PROJECTS,
  validateOkanWebConfig
} from "../public/script/environment.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const stagingFixture = JSON.parse(
  readFileSync(
    path.join(projectRoot, "test", "fixtures", "staging-web-config.json"),
    "utf8"
  )
);

const prodFixture = {
  ...stagingFixture,
  environment: "prod",
  firebase: {
    apiKey: "test-prod-api-key",
    authDomain: "app-academia-2914d.firebaseapp.com",
    projectId: EXPECTED_PROJECTS.prod,
    storageBucket: "app-academia-2914d.firebasestorage.app",
    messagingSenderId: "1080333508962",
    appId: "1:1080333508962:web:test-fixture"
  },
  appCheck: {
    enabled: true,
    provider: "recaptcha_v3",
    siteKey: "test-prod-recaptcha-v3-site-key"
  },
  payments: {
    enabled: true,
    publicKey: "test-prod-payment-public-key"
  }
};

function readSource(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("staging aceita somente o projeto isolado", () => {
  const config = validateOkanWebConfig(stagingFixture);

  assert.equal(config.environment, "staging");
  assert.equal(config.firebase.projectId, EXPECTED_PROJECTS.staging);
  assert.equal(
    config.appCheck.provider,
    EXPECTED_APP_CHECK_PROVIDERS.staging
  );
  assert.equal(config.payments.enabled, false);
});

test("staging rejeita projeto PROD e pagamentos externos", () => {
  assert.throws(
    () => validateOkanWebConfig({
      ...stagingFixture,
      firebase: {
        ...stagingFixture.firebase,
        projectId: EXPECTED_PROJECTS.prod
      }
    }),
    /Projeto Firebase inválido/
  );

  assert.throws(
    () => validateOkanWebConfig({
      ...stagingFixture,
      payments: {
        enabled: true,
        publicKey: "test-payment-key"
      }
    }),
    /Pagamentos externos devem permanecer bloqueados/
  );

  assert.throws(
    () => validateOkanWebConfig({
      ...stagingFixture,
      appCheck: {
        ...stagingFixture.appCheck,
        provider: "recaptcha_v3"
      }
    }),
    /Provedor App Check inválido/
  );
});

test("prod preserva App Check v3 até migração própria", () => {
  const config = validateOkanWebConfig(prodFixture);

  assert.equal(config.environment, "prod");
  assert.equal(config.firebase.projectId, EXPECTED_PROJECTS.prod);
  assert.equal(
    config.appCheck.provider,
    EXPECTED_APP_CHECK_PROVIDERS.prod
  );
  assert.equal(config.payments.enabled, true);
});

test("configuração real rejeita placeholders", () => {
  assert.throws(
    () => validateOkanWebConfig({
      ...stagingFixture,
      fixture: false,
      firebase: {
        ...stagingFixture.firebase,
        apiKey: "<OKAN_STAGING_WEB_API_KEY>"
      }
    }),
    /placeholder/
  );
});

test("fonte pública não possui configuração Firebase fixa", () => {
  const firebaseSource = readSource("public/script/firebase.js");
  const dashboardSource = readSource("public/dashboard.html");

  assert.doesNotMatch(firebaseSource, /AIza[0-9A-Za-z_-]+/);
  assert.doesNotMatch(firebaseSource, /projectId\s*:\s*["']app-academia-2914d/);
  assert.match(firebaseSource, /validateOkanWebConfig\(okanWebConfig\)/);
  assert.match(firebaseSource, /ReCaptchaEnterpriseProvider/);
  assert.doesNotMatch(dashboardSource, /sdk\.mercadopago\.com/);
  assert.match(dashboardSource, /OKAN_PAYMENT_SDK/);
});

test("aliases e targets não possuem projeto default", () => {
  const aliases = JSON.parse(readSource(".firebaserc"));
  const firebaseConfig = JSON.parse(readSource("firebase.json"));

  assert.equal(aliases.projects.default, undefined);
  assert.equal(aliases.projects.staging, EXPECTED_PROJECTS.staging);
  assert.equal(aliases.projects.prod, EXPECTED_PROJECTS.prod);
  assert.deepEqual(
    firebaseConfig.hosting.map((entry) => entry.target),
    ["staging", "prod"]
  );
});

test("artefato fixture de staging não contém PROD nem SDK de pagamentos", () => {
  const build = spawnSync(
    process.execPath,
    [
      "./scripts/build-web.mjs",
      "--env",
      "staging",
      "--config",
      "./test/fixtures/staging-web-config.json"
    ],
    {
      cwd: projectRoot,
      encoding: "utf8"
    }
  );

  assert.equal(build.status, 0, build.stderr);

  const runtimeConfig = readSource("dist/staging/script/runtime-config.js");
  const dashboard = readSource("dist/staging/dashboard.html");
  const manifest = JSON.parse(
    readSource("dist/staging/okan-build-manifest.json")
  );

  assert.equal(manifest.environment, "staging");
  assert.equal(manifest.projectId, EXPECTED_PROJECTS.staging);
  assert.equal(manifest.externalPaymentsEnabled, false);
  assert.equal(manifest.fixture, true);
  assert.doesNotMatch(runtimeConfig, /app-academia-2914d/);
  assert.doesNotMatch(dashboard, /sdk\.mercadopago\.com/);

  const deployVerification = spawnSync(
    process.execPath,
    ["./scripts/verify-deploy-artifact.mjs", "--env", "staging"],
    {
      cwd: projectRoot,
      encoding: "utf8"
    }
  );

  assert.notEqual(deployVerification.status, 0);
  assert.match(deployVerification.stderr, /fixture nunca pode ser implantado/);
});

test("billing possui bloqueio adicional no cliente", () => {
  const serviceSource = readSource(
    "public/script/services/academy-subscription-service.js"
  );
  const academySource = readSource("public/script/modules/academia.js");

  assert.match(serviceSource, /assertExternalPaymentsEnabled\(\)/);
  assert.match(serviceSource, /payments\/disabled-environment/);
  assert.match(academySource, /Pagamentos indisponíveis em STAGING/);
  assert.doesNotMatch(academySource, /APP_USR-/);
});
