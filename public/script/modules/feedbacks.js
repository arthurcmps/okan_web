// script/modules/feedbacks.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js"; // Importa a conexão do nosso ficheiro central!

export async function carregarFeedbacksBeta() {
    const tbody = document.getElementById('table-feedbacks-body');
    try {
        const snapshot = await getDocs(collection(db, "beta_feedback"));
        tbody.innerHTML = '';
        
        if (snapshot.empty) { 
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #aaa;">Nenhum feedback recebido ainda.</td></tr>'; 
            return; 
        }

        let feedbacks = [];
        snapshot.forEach(doc => feedbacks.push(doc.data()));
        feedbacks.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        feedbacks.forEach(fb => {
            const tr = document.createElement('tr');
            const dataFormatada = fb.timestamp ? fb.timestamp.toDate().toLocaleDateString('pt-BR') : '--';
            
            tr.innerHTML = `
                <td style="color: #aaa; font-size: 12px;">${dataFormatada}</td>
                <td><strong style="color: #ffc107;">⭐ ${fb.nota}/5</strong></td>
                <td style="font-size: 13px; color: #ddd;">${fb.confuso || '--'}</td>
                <td style="font-size: 13px; color: #ff5252;">${fb.bugs || '--'}</td>
                <td style="font-size: 13px; color: #00e676;">${fb.gostou || '--'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { 
        console.error("Erro ao carregar feedbacks:", error); 
    }
}