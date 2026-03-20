import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Cole as suas chaves reais do Firebase aqui (as mesmas do script.js)
const firebaseConfig = {
  apiKey: "AIzaSyBRbLUy03Y7628Lv3ruMy5PDq0Y3_zwykw",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.firebasestorage.app",
  messagingSenderId: "1080333508962",
  appId: "1:1080333508962:web:e93dccc19e32aaaf4ccc3b",
  measurementId: "G-BZBJTDFVR3"
};

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- REFERÊNCIAS DO HTML ---
const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');

const menuLinks = document.querySelectorAll('.nav-links li');
const sectionInicio = document.getElementById('section-inicio');
const sectionAcademias = document.getElementById('section-academias');

// --- 1. VERIFICAÇÃO DE SEGURANÇA (Auth Guard) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Vai ao banco de dados ver se o utilizador é administrador
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                
                // Verifica o Papel (Role)
                if (userData.role === 'super_admin' || userData.role === 'gym_admin') {
                    // Acesso Permitido! Escreve o nome no topo
                    adminNameEl.textContent = userData.name || user.email;
                    
                    if(userData.role === 'gym_admin') {
                        adminNameEl.textContent += " (Academia)";
                    }
                } else {
                    // Aluno ou Professor a tentar aceder ao painel
                    alert("Acesso Negado: Esta área é restrita a administradores.");
                    await signOut(auth);
                    window.location.href = "index.html"; // Redireciona para o login
                }
            } else {
                alert("Utilizador não encontrado no banco de dados.");
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Erro ao buscar dados do utilizador:", error);
        }
    } else {
        // Ninguém está logado
        window.location.href = "index.html";
    }
});

// --- 2. LÓGICA DE LOGOUT ---
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = "index.html"; // Volta para a página de login
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
});

// --- 3. NAVEGAÇÃO DO MENU LATERAL (Single Page) ---
// Mapa que liga o texto do botão à secção HTML correspondente
const sectionMap = {
    'Início': sectionInicio,
    'Academias': sectionAcademias,
    // Futuramente adicionaremos 'Professores' e 'Templates' aqui
};

menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        // Remove a classe 'active' de todos os itens
        menuLinks.forEach(item => item.classList.remove('active'));
        
        // Adiciona a classe 'active' apenas ao item clicado
        link.classList.add('active');

        // Esconde todas as secções
        sectionInicio.style.display = 'none';
        sectionAcademias.style.display = 'none';

        // Descobre qual é o texto do menu clicado (ignorando o ícone)
        const menuText = link.textContent.trim().split(' ')[1]; 
        
        // Mostra a secção correspondente
        if (sectionMap[menuText]) {
            sectionMap[menuText].style.display = 'block';
        }
    });
});