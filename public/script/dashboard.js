// script/dashboard.js
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js"; 

// Importação dos Nossos Módulos
import { carregarFeedbacksBeta } from "./modules/feedbacks.js";
import { initLoja, carregarTemplatesLoja } from "./modules/loja.js";
import { carregarTodosProfessores } from "./modules/professores.js";
import { setupAcademiasUI, initAcademiasContext, carregarAcademias, configurarPainelAcademia } from "./modules/academia.js";

const adminNameEl = document.getElementById('admin-name');
let userRole = null; 

// =========================================================
// 1. SISTEMA DE EXCLUSÃO UNIVERSAL (Fica no ficheiro principal)
// =========================================================
const modalExclusao = document.getElementById('modal-confirmar-exclusao');
const textoConfirmacao = document.getElementById('texto-confirmacao-exclusao');
let acaoExclusaoPendente = null;

function confirmarExclusao(mensagemHtml, acaoConfirmada) {
    textoConfirmacao.innerHTML = mensagemHtml;
    acaoExclusaoPendente = acaoConfirmada;
    modalExclusao.style.display = 'flex';
}

document.getElementById('btn-cancelar-exclusao')?.addEventListener('click', () => {
    modalExclusao.style.display = 'none';
    acaoExclusaoPendente = null;
});

document.getElementById('btn-confirmar-exclusao')?.addEventListener('click', async () => {
    if (acaoExclusaoPendente) {
        try {
            await acaoExclusaoPendente();
        } catch (e) {
            console.error(e);
        }
    }
    modalExclusao.style.display = 'none';
    acaoExclusaoPendente = null;
});

// =========================================================
// 2. FUNÇÃO ADICIONADA: CONTAGEM GLOBAL DE ALUNOS (METRICA HOME)
// =========================================================
async function carregarTotalAlunos() {
    const totalStudentsEl = document.getElementById('total-students');
    if (!totalStudentsEl) return;

    try {
        // Consulta todos os usuários cujo papel seja estritamente 'aluno'
        const q = query(collection(db, "users"), where("role", "==", "aluno"));
        const snapshot = await getDocs(q);
        
        // Atribui o tamanho da query de forma segura como texto plano
        totalStudentsEl.textContent = snapshot.size.toString();
    } catch (error) {
        console.error("Erro ao contabilizar alunos globais:", error);
        totalStudentsEl.textContent = "0";
    }
}

// =========================================================
// 3. ROTEAMENTO DE PERMISSÕES E INICIALIZAÇÃO (RBAC)
// =========================================================
const menuLinks = document.querySelectorAll('.nav-links li');
const sectionMap = {
    'inicio': document.getElementById('section-inicio'),
    'academias': document.getElementById('section-academias'),
    'professores': document.getElementById('section-professores'),
    'templates': document.getElementById('section-templates'),
    'feedbacks': document.getElementById('section-feedbacks'),
    'detalhes-academia': document.getElementById('section-detalhes-academia'),
    'planos': document.getElementById('section-planos')
};

onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-overlay');
    
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userRole = userData.role;
                
                if (adminNameEl) adminNameEl.textContent = userData.name || user.email;

                // Inicializa os contextos necessários
                initAcademiasContext(userRole, user.email, confirmarExclusao);
                initLoja(confirmarExclusao);
                setupAcademiasUI();

                if (userRole === 'super_admin') {
                    // SE FOR VOCÊ (Acesso total às métricas globais e tabelas)
                    await Promise.all([
                        carregarAcademias(),
                        carregarTodosProfessores(),
                        carregarTotalAlunos(), // <-- CARREGA A NOVA MÉTRICA AQUI
                        carregarFeedbacksBeta(),
                        carregarTemplatesLoja()
                    ]);
                } else if (userRole === 'gym_admin') {
                    // SE FOR GESTOR (Redireciona direto e esconde o painel global)
                    await configurarPainelAcademia(user.email);
                } else {
                    // Segurança adicional contra invasão de papéis inválidos
                    await signOut(auth);
                    window.location.href = "index.html";
                }
            } else {
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Erro ao validar sessão do administrador:", error);
            window.location.href = "index.html";
        } finally {
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 300);
            }
        }
    } else {
        window.location.href = "index.html";
    }
});

// =========================================================
// 4. EVENTOS DE INTERFACE (MENUS E LOGOUT)
// =========================================================
document.getElementById('logout-btn')?.addEventListener('click', async () => { 
    await signOut(auth); 
    window.location.href = "index.html"; 
});

menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (userRole === 'gym_admin' && link.id !== 'menu-minha-academia' && link.id !== 'menu-planos') return;
        
        menuLinks.forEach(item => item.classList.remove('active'));
        link.classList.add('active');
        Object.values(sectionMap).forEach(s => { if(s) s.style.display = 'none'; });
        const target = link.getAttribute('data-target');
        if (sectionMap[target]) {
            sectionMap[target].style.display = 'block';
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = link.textContent.trim();
        }
    });
});

document.getElementById('btn-voltar-academias')?.addEventListener('click', () => { 
    const target = document.querySelector('[data-target=\"academias\"]');
    if (target) target.click();
});