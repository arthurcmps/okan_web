import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { renderSkeleton } from "./skeleton.js";
import { USER_ROLES, normalizeUser} from "../models/user-model.mjs";

function criarBadgeVinculo(prof) {
    const span = document.createElement('span');
    if (prof.academiaNome) {
        span.style.color = '#00e676';
        span.style.fontWeight = '500';
        span.textContent = prof.academiaNome;
    } else if (prof.academyId) {
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
    renderSkeleton(
        'table-todos-professores-body',
        5,
        3
    );

    const tbody =
        document.getElementById(
            'table-todos-professores-body'
        );

    if (!tbody) return;

    try {
        /*
         * Compatibilidade Fase 4.
         *
         * Precisamos encontrar tanto:
         * - role=professor
         * - role=personal legado
         * - tipo=personal legado
         *
         * Depois da migração, voltaremos para uma query
         * direta role == professor.
         */
        const snapshot =
            await getDocs(collection(db, "users"));

        const professores = snapshot.docs
            .map((docSnap) => {
                const raw = docSnap.data();

                const normalized = normalizeUser(
                    raw,
                    docSnap.id
                );

                return {
                    ...normalized,

                    // Apenas compatibilidade visual temporária.
                    academiaNome:
                        typeof raw.academiaNome === "string"
                            ? raw.academiaNome.trim()
                            : null,

                    /*
                     * Campo legado usado somente pela UI atual.
                     * String "true" não é considerada premium.
                     */
                    isPremium:
                        raw.isPremium === true
                };
            })
            .filter(
                (user) =>
                    user.role ===
                    USER_ROLES.professor
            );

        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }

        let contagemPremium = 0;

        if (professores.length === 0) {
            const tr =
                document.createElement('tr');

            const td =
                document.createElement('td');

            td.colSpan = 5;
            td.style.textAlign = 'center';
            td.style.color = '#aaa';
            td.textContent =
                'Nenhum professor na base de dados.';

            tr.appendChild(td);
            tbody.appendChild(tr);

            const totalProfsEl =
                document.getElementById(
                    'total-profs'
                );

            if (totalProfsEl) {
                totalProfsEl.textContent = "0";
            }

            return;
        }

        professores.forEach((prof) => {
            if (prof.isPremium) {
                contagemPremium++;
            }

            const linhaDom =
                criarLinhaProfessor(prof);

            tbody.appendChild(linhaDom);
        });

        const totalProfsEl =
            document.getElementById(
                'total-profs'
            );

        if (totalProfsEl) {
            totalProfsEl.textContent =
                contagemPremium.toString();
        }

    } catch (error) {
        console.error(
            "Erro ao carregar professores:",
            error
        );

        tbody.innerHTML =
            '<tr><td colspan="5" ' +
            'style="text-align: center; color: #ff5252;">' +
            'Erro ao carregar dados.</td></tr>';
    }
}