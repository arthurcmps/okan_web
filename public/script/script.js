import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: COLE AS SUAS CHAVES DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "AIzaSyBRbLUy03Y7628Lv3ruMy5PDq0Y3_zwykw",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.firebasestorage.app",
  messagingSenderId: "1080333508962",
  appId: "1:1080333508962:web:e93dccc19e32aaaf4ccc3b",
  measurementId: "G-BZBJTDFVR3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências aos elementos do HTML
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const provider = new GoogleAuthProvider();

googleLoginBtn.addEventListener('click', async () => {
    googleLoginBtn.textContent = "A carregar...";
    errorMessage.textContent = "";

    try {
        // Abre a janela (Popup) do Google para o utilizador escolher a conta
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Se der certo, envia para o Dashboard (o dashboard.js vai barrar se não for super_admin)
        window.location.href = "dashboard.html";
        
    } catch (error) {
        console.error("Erro no login com Google:", error);
        errorMessage.textContent = "Erro ao autenticar com o Google.";
        googleLoginBtn.textContent = "Entrar com o Google";
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede a página de recarregar
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // Feedback visual de carregamento
    loginBtn.textContent = "A entrar...";
    loginBtn.disabled = true;
    errorMessage.textContent = "";

    try {
        // 1. Tentar fazer login no Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. O SUCESSO: Redirecionar para o painel (vamos criar o painel no próximo passo)
        alert(`Bem-vindo! Login efetuado com o UID: ${user.uid}`);
        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erro no login:", error);
        // Tratamento de erros amigável
        if (error.code === 'auth/invalid-credential') {
            errorMessage.textContent = "E-mail ou senha incorretos.";
        } else {
            errorMessage.textContent = "Erro ao fazer login. Tente novamente.";
        }
    } finally {
        loginBtn.textContent = "Entrar no Painel";
        loginBtn.disabled = false;
    }
});