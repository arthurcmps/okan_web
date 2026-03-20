import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// SUAS CHAVES REAIS
const firebaseConfig = {
  apiKey: "AIzaSyBRbLUy03Y7628Lv3ruMy5PDq0Y3_zwykw",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.firebasestorage.app",
  messagingSenderId: "1080333508962",
  appId: "1:1080333508962:web:e93dccc19e32aaaf4ccc3b",
  measurementId: "G-BZBJTDFVR3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// REFERÊNCIAS GERAIS
const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');

// 1. SEGURANÇA (Auth Guard)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.role === 'super_admin' || userData.role === 'gym_admin') {
                    adminNameEl.textContent = userData.name || user.email;
                    if(userData.role === 'gym_admin') {
                        adminNameEl.textContent += " (Academia)";
                    }
                } else {
                    alert("Acesso Negado: Área restrita a administradores.");
                    await signOut(auth);
                    window.location.href = "index.html";
                }
            } else {
                alert("Usuário não encontrado.");
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Erro:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// 2. NAVEGAÇÃO DO MENU (Totalmente segura agora)
const menuLinks = document.querySelectorAll('.nav-links li');
const sectionMap = {
    'inicio': document.getElementById('section-inicio'),
    'academias': document.getElementById('section-academias')
};

menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        // Remove 'active' de todos
        menuLinks.forEach(item => item.classList.remove('active'));
        // Adiciona ao clicado
        link.classList.add('active');

        // Esconde todas as secções
        Object.values(sectionMap).forEach(section => {
            if(section) section.style.display = 'none';
        });

        // Mostra a secção correta pelo data-target
        const target = link.getAttribute('data-target');
        if (sectionMap[target]) {
            sectionMap[target].style.display = 'block';
            document.getElementById('page-title').textContent = link.textContent.trim();
        }
    });
});

// 3. LÓGICA DO MODAL (Janela de Nova Academia)
const modalNovaAcademia = document.getElementById('modal-nova-academia');
const btnNovaAcademia = document.getElementById('btn-nova-academia');
const fecharModal = document.getElementById('fechar-modal');
const formNovaAcademia = document.getElementById('form-nova-academia');

// Abrir
btnNovaAcademia.addEventListener('click', () => {
    modalNovaAcademia.style.display = 'flex';
});

// Fechar no X
fecharModal.addEventListener('click', () => {
    modalNovaAcademia.style.display = 'none';
});

// Fechar clicando fora da caixa
window.addEventListener('click', (e) => {
    if (e.target === modalNovaAcademia) {
        modalNovaAcademia.style.display = 'none';
    }
});

// 4. PREPARATIVO PARA SALVAR NO FIREBASE
formNovaAcademia.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('acad-nome').value;
    const email = document.getElementById('acad-email').value;
    const licencas = document.getElementById('acad-licencas').value;

    alert(`Preparado para salvar a academia ${nome} com ${licencas} licenças! Vamos conectar isso ao banco de dados agora.`);
    
    // Esconde o modal e limpa o formulário
    modalNovaAcademia.style.display = 'none';
    formNovaAcademia.reset();
});