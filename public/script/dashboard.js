import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Cole as mesmas chaves do firebaseConfig do app.js aqui
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências HTML
const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');

// VERIFICAÇÃO DE SEGURANÇA (O Guardião do Portão)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // O utilizador tem uma conta, mas será que é administrador?
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                
                // Verifica a Role (Papel)
                if (userData.role === 'super_admin' || userData.role === 'gym_admin') {
                    // Acesso Permitido!
                    adminNameEl.textContent = userData.name || user.email;
                    
                    // Se for dono de academia, podemos esconder a aba "Academias" depois
                    if(userData.role === 'gym_admin') {
                        adminNameEl.textContent += " (Academia)";
                    }
                } else {
                    // É um aluno ou professor tentando bisbilhotar!
                    alert("Acesso Negado: Esta área é restrita a administradores.");
                    await signOut(auth);
                    window.location.href = "index.html";
                }
            } else {
                alert("Utilizador não encontrado no banco de dados.");
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Erro ao buscar dados:", error);
        }
    } else {
        // Ninguém está logado, manda de volta para o login
        window.location.href = "index.html";
    }
});

// FUNÇÃO DE SAIR (Logout)
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
});