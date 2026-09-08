// script/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";
import {
  installEnvironmentBanner,
  validateOkanWebConfig
} from "./environment.js";
import { okanWebConfig } from "./runtime-config.js";

const webEnvironment = validateOkanWebConfig(okanWebConfig);
const firebaseConfig = webEnvironment.firebase;

installEnvironmentBanner(webEnvironment);

// Inicializa os serviços
const app = initializeApp(firebaseConfig);
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(webEnvironment.appCheck.siteKey),
  
  // Isso faz com que o token se renove sozinho antes de expirar
  isTokenAutoRefreshEnabled: true
});
const auth = getAuth(app);
const db = getFirestore(app);

// Callables novas ficam próximas ao Firestore em southamerica-east1.
const functions = getFunctions(app, "southamerica-east1");

// O motor B2B existente ainda está publicado na região padrão.
// Mantemos essa instância até a migração de região ser planejada
// como uma mudança própria, sem mover endpoints durante o hotfix.
const billingFunctions = getFunctions(app, "us-central1");

const externalPaymentsEnabled = webEnvironment.payments.enabled;
const mercadoPagoPublicKey = webEnvironment.payments.publicKey;

// Exporta para ser usado nos outros ficheiros
export {
  auth,
  db,
  functions,
  billingFunctions,
  appCheck,
  webEnvironment,
  externalPaymentsEnabled,
  mercadoPagoPublicKey
};
