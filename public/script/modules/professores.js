// script/modules/professores.js
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { renderSkeleton } from "./skeleton.js";

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

    const tdNome = document.createElement('td');
    tdNome.style.fontWeight = 'bold';
    tdNome.textContent = prof.name || 'Sem nome';

    const tdEmail = document.createElement('td');
    tdEmail.textContent = prof.email || '--';

    const tdVinculo = document.createElement('td');
    tdVinculo.appendChild(criarBadgeVinculo(prof));

    const tdPremium = document.createElement('td');
    tdPremium.appendChild(criarBadgePremium(prof.isPremium));

    const tdAcoes = document.createElement('td');
    const btnDetalhes = document.createElement('button');
    btnDetalhes.className = 'action-btn';
    btnDetalhes.title = 'Ver Detalhes';
    
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'visibility';
    
    btnDetalhes.appendChild(icon);
    tdAcoes.appendChild(btnDetalhes);

    tr.append(tdNome, tdEmail, tdVinculo, tdPremium, tdAcoes);
    return tr;
}

export async function carregarTodosProfessores() {
    // Aciona o Skeleton Loader (5 colunas, 3 linhas)
    renderSkeleton('table-todos-professores-body', 5, 3);
    
    const tbody = document.getElementById('table-todos-professores-body');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "users"), where("role", "==", "professor"));
        const snapshot = await getDocs(q);
        
        // Limpeza segura dos skeletons apenas quando a query termina
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
        
        let contagemPremium = 0;
        
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

        snapshot.forEach((docSnap) => {
            const prof = docSnap.data();
            if (prof.isPremium) contagemPremium++;
            const linhaDom = criarLinhaProfessor(prof);
            tbody.appendChild(linhaDom);
        });

        const totalProfsEl = document.getElementById('total-profs');
        if (totalProfsEl) totalProfsEl.textContent = contagemPremium.toString();

    } catch (error) { 
        console.error("Erro ao carregar professores:", error); 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5252;">Erro ao carregar dados.</td></tr>';
    }
}