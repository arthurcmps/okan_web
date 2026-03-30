// script/modules/professores.js
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";

export async function carregarTodosProfessores() {
    const tbody = document.getElementById('table-todos-professores-body');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "users"), where("role", "==", "professor"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        let contagemPremium = 0;
        
        if (snapshot.empty) { 
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #aaa;">Nenhum professor.</td></tr>'; 
            document.getElementById('total-profs').textContent = "0"; 
            return; 
        }

        snapshot.forEach((docSnap) => {
            const prof = docSnap.data();
            const tr = document.createElement('tr');
            let vinculoHtml = '<span style="color: #aaa; font-style: italic;">Autônomo</span>';
            if (prof.academiaNome) vinculoHtml = `<span style="color: #00e676; font-weight: 500;">${prof.academiaNome}</span>`;
            else if (prof.academiaId) vinculoHtml = `<span style="color: #00e676; font-weight: 500;">Vinculado</span>`; 

            let premiumHtml = '<span style="color: #aaa; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Gratuito</span>';
            if (prof.isPremium) { 
                contagemPremium++; 
                premiumHtml = '<span style="color: #00e676; border: 1px solid #00e676; background: rgba(0, 230, 118, 0.1); padding: 4px 8px; border-radius: 4px; font-size: 12px;">Premium</span>'; 
            }
            
            tr.innerHTML = `
                <td style="font-weight: bold;">${prof.name || 'Sem nome'}</td>
                <td>${prof.email}</td>
                <td>${vinculoHtml}</td>
                <td>${premiumHtml}</td>
                <td><button class="action-btn" title="Ver Detalhes"><span class="material-symbols-outlined" style="font-size: 18px;">visibility</span></button></td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('total-profs').textContent = contagemPremium.toString();
    } catch (error) { 
        console.error("Erro ao carregar professores:", error); 
    }
}