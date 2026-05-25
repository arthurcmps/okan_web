import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
const linkEsqueciSenha = document.getElementById('esqueci-senha-link');
const provider = new GoogleAuthProvider();

// Lógica de Redefinição de Senha
linkEsqueciSenha.addEventListener('click', (e) => {
    e.preventDefault(); // Impede o salto da página
    
    const emailValue = emailInput.value.trim();

    // Reseta a cor de erro padrão
    errorMessage.style.color = "#ff5252";

    if (!emailValue) {
        errorMessage.textContent = "Por favor, digite seu e-mail no campo acima para redefinir a senha.";
        return;
    }

    errorMessage.textContent = "A enviar e-mail de redefinição...";
    errorMessage.style.color = "#aaaaaa";

    sendPasswordResetEmail(auth, emailValue)
        .then(() => {
            errorMessage.style.color = "#00e676"; // Cor de sucesso verde
            errorMessage.textContent = "E-mail de redefinição enviado! Verifique sua caixa de entrada (e spam).";
        })
        .catch((error) => {
            console.error("Erro ao tentar redefinir senha:", error);
            errorMessage.style.color = "#ff5252"; // Volta para cor de erro
            
            if (error.code === 'auth/user-not-found') {
                errorMessage.textContent = "Não encontramos nenhuma conta com este e-mail.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage.textContent = "Por favor, insira um endereço de e-mail válido.";
            } else {
                errorMessage.textContent = "Ocorreu um erro ao enviar o e-mail. Tente novamente.";
            }
        });
});

googleLoginBtn.addEventListener('click', async () => {
    googleLoginBtn.textContent = "A carregar...";
    errorMessage.textContent = "";

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        window.location.href = "../dashboard.html";
        
    } catch (error) {
        console.error("Erro no login com Google:", error);
        errorMessage.textContent = "Erro ao autenticar com o Google.";
        googleLoginBtn.textContent = "Entrar com o Google";
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    loginBtn.textContent = "A entrar...";
    loginBtn.disabled = true;
    errorMessage.textContent = "";
    errorMessage.style.color = "#ff5252"; // Garante cor de erro

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        loginBtn.textContent = "Redirecionando...";
        window.location.href = "dashboard.html"; 

    } catch (error) {
        console.error("Erro no login:", error);
        if (error.code === 'auth/invalid-credential') {
            errorMessage.textContent = "E-mail ou senha incorretos.";
        } else {
            errorMessage.textContent = "Erro ao fazer login. Tente novamente.";
        }
        
        loginBtn.textContent = "Entrar no Painel";
        loginBtn.disabled = false;
    } 
});