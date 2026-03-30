import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js"; 

// Importação dos Nossos Módulos
import { carregarFeedbacksBeta } from "./modules/feedbacks.js";
import { initLoja, carregarTemplatesLoja } from "./modules/loja.js";
import { carregarTodosProfessores } from "./modules/professores.js";
import { setupAcademiasUI, initAcademiasContext, carregarAcademias, configurarPainelAcademia } from "./modules/academias.js";

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
    if (!acaoExclusaoPendente) return;
    const btnConf = document.getElementById('btn-confirmar-exclusao');
    btnConf.textContent = "Processando..."; btnConf.disabled = true;
    try { 
        await acaoExclusaoPendente(); 
        modalExclusao.style.display = 'none'; 
    } catch (e) { 
        console.error(e); alert("Erro na exclusão."); 
    } finally { 
        btnConf.textContent = "Confirmar"; btnConf.disabled = false; acaoExclusaoPendente = null; 
    }
});

// =========================================================
// 2. INICIALIZAÇÃO DE MÓDULOS (Conectando tudo)
// =========================================================
initLoja(confirmarExclusao);
setupAcademiasUI();

// =========================================================
// 3. SEGURANÇA E NAVEGAÇÃO DE MENU
// =========================================================
const menuLinks = document.querySelectorAll('.nav-links li');
const sectionMap = {
    'inicio': document.getElementById('section-inicio'),
    'academias': document.getElementById('section-academias'),
    'detalhes-academia': document.getElementById('section-detalhes-academia'),
    'professores': document.getElementById('section-professores'),
    'templates': document.getElementById('section-templates'),
    'feedbacks': document.getElementById('section-feedbacks')
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                userRole = docSnap.data().role;
                if (adminNameEl) adminNameEl.textContent = docSnap.data().name || user.email;

                // Informa o módulo de academias sobre quem está logado
                initAcademiasContext(userRole, user.email, confirmarExclusao);

                if (userRole === 'super_admin') {
                    carregarAcademias();
                    carregarTodosProfessores();
                    carregarTemplatesLoja();
                    carregarFeedbacksBeta();
                    
                    // Remove a cortina de carregamento com fade out
                    const loader = document.getElementById('loader-overlay');
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => loader.style.display = 'none', 300);
                    }

                } else if (userRole === 'gym_admin') {
                    const menuFeedbacks = document.getElementById('menu-feedbacks');
                    if (menuFeedbacks) menuFeedbacks.style.display = 'none';
                    
                    await configurarPainelAcademia(user.email);
                    
                    // Remove a cortina de carregamento com fade out
                    const loader = document.getElementById('loader-overlay');
                    if (loader) {
                        loader.style.opacity = '0';
                        setTimeout(() => loader.style.display = 'none', 300);
                    }

                } else {
                    alert("Acesso Negado."); await signOut(auth); window.location.href = "index.html";
                }
            } else { await signOut(auth); window.location.href = "index.html"; }
        } catch (error) { console.error(error); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('logout-btn')?.addEventListener('click', async () => { 
    await signOut(auth); 
    window.location.href = "index.html"; 
});

menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (userRole === 'gym_admin' && link.id !== 'menu-minha-academia') return;
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
    const target = document.querySelector('[data-target="academias"]');
    if (target) target.click(); 
});

// Esconde o modal de exclusão global ao clicar fora
window.addEventListener('click', (e) => {
    if (e.target === modalExclusao) modalExclusao.style.display = 'none';
});