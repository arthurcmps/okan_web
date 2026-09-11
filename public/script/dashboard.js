// script/dashboard.js
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js"; 

// Importação dos Nossos Módulos
import { carregarFeedbacksBeta } from "./modules/feedbacks.js";
import { initLoja, carregarTemplatesLoja } from "./modules/loja.js";
import { carregarTodosProfessores } from "./modules/professores.js?v=1.1";
import { setupAcademiasUI, initAcademiasContext, carregarAcademias, configurarPainelAcademia } from "./modules/academia.js";
import { MEMBER_TYPES, USER_ROLES, normalizeUser } from "./models/user-model.mjs";

const adminNameEl = document.getElementById('admin-name');
let userRole = null; 

// =========================================================
// 1. SISTEMA DE EXCLUSÃO UNIVERSAL (Fica no ficheiro principal)
// =========================================================
const modalExclusao = document.getElementById('modal-confirmar-exclusao');
const textoConfirmacao = document.getElementById('texto-confirmacao-exclusao');
let acaoExclusaoPendente = null;

function confirmarExclusao(mensagem, acaoConfirmada) {
    textoConfirmacao.textContent = mensagem;
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
// 2. CONTAGEM GLOBAL DE ALUNOS (PERSONA MOBILE)
// =========================================================
async function carregarTotalAlunos() {
    const totalStudentsEl =
        document.getElementById('total-students');

    if (!totalStudentsEl) return;

    try {
        /*
         * Aluno/professor é uma persona funcional, não um papel RBAC.
         *
         * A coleção ainda é normalizada por compatibilidade com clientes
         * legados, mas a métrica usa memberType para incluir corretamente
         * identidades híbridas como super_admin + memberType=aluno.
         */
        const snapshot =
            await getDocs(collection(db, "users"));

        const totalAlunos = snapshot.docs
            .map((docSnap) =>
                normalizeUser(
                    docSnap.data(),
                    docSnap.id
                )
            )
            .filter(
                (user) =>
                    user.memberType === MEMBER_TYPES.aluno
            )
            .length;

        totalStudentsEl.textContent =
            totalAlunos.toString();

    } catch (error) {
        console.error(
            "Erro ao contabilizar alunos globais:",
            error
        );

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
const mobileMoreButton = document.getElementById('mobile-more-button');
const mobileMoreMenu = document.getElementById('mobile-more-menu');

function fecharMenuMobileMais({ restaurarFoco = false } = {}) {
    if (!mobileMoreButton || !mobileMoreMenu) return;

    mobileMoreMenu.hidden = true;
    mobileMoreButton.setAttribute('aria-expanded', 'false');
    mobileMoreButton.setAttribute('aria-label', 'Abrir mais opções do painel');

    if (restaurarFoco) mobileMoreButton.focus();
}

function abrirMenuMobileMais() {
    if (!mobileMoreButton || !mobileMoreMenu) return;

    mobileMoreMenu.hidden = false;
    mobileMoreButton.setAttribute('aria-expanded', 'true');
    mobileMoreButton.setAttribute('aria-label', 'Fechar mais opções do painel');

    const primeiraAcao = [...mobileMoreMenu.querySelectorAll('button')]
        .find(button => !button.hidden);

    primeiraAcao?.focus();
}

function sincronizarOpcoesMobileMais() {
    if (!mobileMoreMenu) return;

    mobileMoreMenu.querySelectorAll('[data-nav-proxy]').forEach(action => {
        const targetId = action.dataset.navProxy;
        const target = document.getElementById(targetId);

        action.hidden = !target || target.style.display === 'none';
    });
}

function atualizarEstadoMobileMais(link) {
    if (!mobileMoreButton) return;

    const isSecondaryDestination = link.id === 'menu-feedbacks';
    mobileMoreButton.classList.toggle('active', isSecondaryDestination);

    if (isSecondaryDestination) {
        mobileMoreButton.setAttribute('aria-current', 'page');
    } else {
        mobileMoreButton.removeAttribute('aria-current');
    }
}

mobileMoreButton?.addEventListener('click', () => {
    if (mobileMoreButton.getAttribute('aria-expanded') === 'true') {
        fecharMenuMobileMais({ restaurarFoco: true });
        return;
    }

    sincronizarOpcoesMobileMais();
    abrirMenuMobileMais();
});

mobileMoreMenu?.querySelectorAll('[data-nav-proxy]').forEach(action => {
    action.addEventListener('click', () => {
        const target = document.getElementById(action.dataset.navProxy);
        target?.click();
        fecharMenuMobileMais({ restaurarFoco: true });
    });
});

document.getElementById('mobile-logout-button')?.addEventListener('click', () => {
    fecharMenuMobileMais();
    document.getElementById('logout-btn')?.click();
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || mobileMoreMenu?.hidden !== false) return;

    event.preventDefault();
    fecharMenuMobileMais({ restaurarFoco: true });
});

document.addEventListener('click', event => {
    if (
        mobileMoreMenu?.hidden !== false ||
        mobileMoreMenu.contains(event.target) ||
        mobileMoreButton?.contains(event.target)
    ) {
        return;
    }

    fecharMenuMobileMais();
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) fecharMenuMobileMais();
});

onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('loader-overlay');
    
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (userDoc.exists()) {
                const userData = normalizeUser(
                    userDoc.data(),
                    userDoc.id
                );

                userRole = userData.role;

                if (adminNameEl) {
                    adminNameEl.textContent =
                        userData.name || user.email;
                }

                // Inicializa os contextos necessários
                initAcademiasContext(userRole, user.email, confirmarExclusao);
                initLoja(confirmarExclusao);
                setupAcademiasUI();

                if (userRole === USER_ROLES.superAdmin) {
                    // SE FOR VOCÊ (Acesso total às métricas globais e tabelas)
                    await Promise.all([
                        carregarAcademias(),
                        carregarTodosProfessores(),
                        carregarTotalAlunos(), // <-- CARREGA A NOVA MÉTRICA AQUI
                        carregarFeedbacksBeta(),
                        carregarTemplatesLoja()
                    ]);
                } else if (userRole === USER_ROLES.gymAdmin) {
                    // SE FOR GESTOR (Redireciona direto e esconde o painel global)
                    await configurarPainelAcademia(user.email);
                } else {
                    // Segurança adicional contra invasão de papéis inválidos
                    await signOut(auth);
                    window.location.href = "index.html";
                }

                sincronizarOpcoesMobileMais();
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

function ativarItemMenu(link) {
    if (
        userRole === USER_ROLES.gymAdmin &&
        link.id !== 'menu-minha-academia' &&
        link.id !== 'menu-planos'
    ) {
        return;
    }

    menuLinks.forEach(item => {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
    });
    link.classList.add('active');
    link.setAttribute('aria-current', 'page');
    atualizarEstadoMobileMais(link);
    fecharMenuMobileMais();

    Object.values(sectionMap).forEach(s => {
        if (s) s.style.display = 'none';
    });

    const target = link.getAttribute('data-target');

    if (sectionMap[target]) {
        sectionMap[target].style.display = 'block';

        const pageTitle = document.getElementById('page-title');

        if (pageTitle) {
            pageTitle.textContent = link.dataset.label || link.textContent.trim();
        }
    }
}

function acionarComTeclado(event, element) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    element.click();
}

menuLinks.forEach(link => {
    link.addEventListener('click', () => ativarItemMenu(link));
    link.addEventListener('keydown', event => acionarComTeclado(event, link));
});

document.getElementById('btn-voltar-academias')?.addEventListener('click', () => { 
    const target = document.querySelector('[data-target=\"academias\"]');
    if (target) target.click();
});
