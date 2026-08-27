// script/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRbLUy03Y7628Lv3ruMy5PDq0Y3_zwykw",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.firebasestorage.app",
  messagingSenderId: "1080333508962",
  appId: "1:1080333508962:web:e93dccc19e32aaaf4ccc3b"
};

// Inicializa os serviços
const app = initializeApp(firebaseConfig);
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LcGNk4tAAAAALb-DBADJhVIBm1-j9gjMnGRCAwT'),
  
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

// Exporta para ser usado nos outros ficheiros
export { auth, db, functions, billingFunctions, appCheck };