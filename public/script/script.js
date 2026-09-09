import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTAÇÃO CENTRALIZADA
import { auth } from "./firebase.js"; 
import { setupPasswordVisibility } from "./modules/password-visibility.js";

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');
const googleLoginBtn = document.getElementById('google-login-btn');
const googleLoginLabel = document.getElementById('google-login-label');
const linkEsqueciSenha = document.getElementById('esqueci-senha-link');
const provider = new GoogleAuthProvider();

setupPasswordVisibility({
    inputId: 'password',
    toggleId: 'toggle-password'
});

linkEsqueciSenha.addEventListener('click', (e) => {
    e.preventDefault(); 
    
    const emailValue = emailInput.value.trim();
    errorMessage.style.color = "var(--okan-color-error)";

    if (!emailValue) {
        errorMessage.textContent = "Por favor, digite seu e-mail no campo acima para redefinir a senha.";
        return;
    }

    errorMessage.textContent = "A enviar e-mail de redefinição...";
    errorMessage.style.color = "var(--okan-color-text-sub)";

    sendPasswordResetEmail(auth, emailValue)
        .then(() => {
            errorMessage.style.color = "var(--okan-color-primary)";
            errorMessage.textContent = "E-mail de redefinição enviado! Verifique sua caixa de entrada (e spam).";
        })
        .catch((error) => {
            console.error("Erro ao tentar redefinir senha:", error);
            errorMessage.style.color = "var(--okan-color-error)";
            
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
    googleLoginLabel.textContent = "A carregar...";
    googleLoginBtn.disabled = true;
    googleLoginBtn.setAttribute('aria-busy', 'true');
    errorMessage.textContent = "";

    try {
        await signInWithPopup(auth, provider);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Erro no login com Google:", error);
        errorMessage.textContent = "Erro ao autenticar com o Google.";
        googleLoginLabel.textContent = "Entrar com o Google";
        googleLoginBtn.disabled = false;
        googleLoginBtn.removeAttribute('aria-busy');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    loginBtn.textContent = "A entrar...";
    loginBtn.disabled = true;
    loginBtn.setAttribute('aria-busy', 'true');
    errorMessage.textContent = "";
    errorMessage.style.color = "var(--okan-color-error)";

    try {
        await signInWithEmailAndPassword(auth, email, password);
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
        loginBtn.removeAttribute('aria-busy');
    } 
});
