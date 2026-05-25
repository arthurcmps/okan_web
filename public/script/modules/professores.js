// script/modules/professores.js
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js"; // Importação centralizada

// =========================================================
// COMPONENTES PUROS DO DOM (Prevenção de XSS)
// =========================================================

function criarBadgeVinculo(prof) {
    const span = document.createElement('span');
    
    if (prof.academiaNome) {
        span.style.color = '#00e676';
        span.style.fontWeight = '500';
        span.textContent = prof.academiaNome;
    } else if (prof.academiaId) {
        span.style.color = '#00e676';
        span.style.fontWeight = '500';
        span.textContent = 'Vinculado';
    } else {
        span.style.color = '#aaa';
        span.style.fontStyle = 'italic';
        span.textContent = 'Autônomo';
    }
    
    return span;
}

function criarBadgePremium(isPremium) {
    const span = document.createElement('span');
    span.style.border = '1px solid';
    span.style.padding = '4px 8px';
    span.style.borderRadius = '4px';
    span.style.fontSize = '12px';

    if (isPremium) {
        span.style.color = '#00e676';
        span.style.borderColor = '#00e676';
        span.style.background = 'rgba(0, 230, 118, 0.1)';
        span.textContent = 'Premium';
    } else {
        span.style.color = '#aaa';
        span.style.borderColor = '#555';
        span.textContent = 'Gratuito';
    }
    
    return span;
}

function criarLinhaProfessor(prof) {
    const tr = document.createElement('tr');

    // Coluna Nome
    const tdNome = document.createElement('td');
    tdNome.style.fontWeight = 'bold';
    tdNome.textContent = prof.name || 'Sem nome';

    // Coluna E-mail
    const tdEmail = document.createElement('td');
    tdEmail.textContent = prof.email || '--';

    // Coluna Vínculo (Usa o componente)
    const tdVinculo = document.createElement('td');
    tdVinculo.appendChild(criarBadgeVinculo(prof));

    // Coluna Status Premium (Usa o componente)
    const tdPremium = document.createElement('td');
    tdPremium.appendChild(criarBadgePremium(prof.isPremium));

    // Coluna Ações
    const tdAcoes = document.createElement('td');
    const btnDetalhes = document.createElement('button');
    btnDetalhes.className = 'action-btn';
    btnDetalhes.title = 'Ver Detalhes';
    
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'visibility';
    
    btnDetalhes.appendChild(icon);
    
    // Preparação para futura expansão de detalhes
    btnDetalhes.addEventListener('click', () => {
        console.log("Abrir detalhes do professor:", prof.email);
    });

    tdAcoes.appendChild(btnDetalhes);

    // Monta a linha
    tr.append(tdNome, tdEmail, tdVinculo, tdPremium, tdAcoes);
    return tr;
}

// =========================================================
// FUNÇÃO PRINCIPAL DE CARREGAMENTO
// =========================================================

export async function carregarTodosProfessores() {
    const tbody = document.getElementById('table-todos-professores-body');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "users"), where("role", "==", "professor"));
        const snapshot = await getDocs(q);
        
        // Limpeza segura do DOM (Evita memory leaks)
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
        
        let contagemPremium = 0;
        
        // Estado Vazio (Empty State)
        if (snapshot.empty) { 
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.style.textAlign = 'center';
            td.style.color = '#aaa';
            td.textContent = 'Nenhum professor na base de dados.';
            
            tr.appendChild(td);
            tbody.appendChild(tr);
            
            const totalProfsEl = document.getElementById('total-profs');
            if (totalProfsEl) totalProfsEl.textContent = "0"; 
            return; 
        }

        // Renderização dos Componentes
        snapshot.forEach((docSnap) => {
            const prof = docSnap.data();
            if (prof.isPremium) contagemPremium++;
            
            const linhaDom = criarLinhaProfessor(prof);
            tbody.appendChild(linhaDom);
        });

        // Atualiza a métrica no painel superior
        const totalProfsEl = document.getElementById('total-profs');
        if (totalProfsEl) totalProfsEl.textContent = contagemPremium.toString();

    } catch (error) { 
        console.error("Erro ao carregar professores:", error); 
    }
}