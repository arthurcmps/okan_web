import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, getDocs, serverTimestamp, updateDoc, deleteDoc, increment, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Variáveis Globais
const adminNameEl = document.getElementById('admin-name');
let modoEdicao = false;
let idAcademiaEditando = null;

// Variáveis da Academia Aberta (Para os Professores)
let academiaAtualId = null; 
let academiaAtualLicencasTotais = 0;
let academiaAtualLicencasUsadas = 0;

// 1. SEGURANÇA (Auth Guard)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && (docSnap.data().role === 'super_admin' || docSnap.data().role === 'gym_admin')) {
                adminNameEl.textContent = docSnap.data().name || user.email;
                carregarAcademias();
                carregarTodosProfessores(); // Inicia a busca global
            } else {
                alert("Acesso Negado.");
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) { console.error(error); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// 2. NAVEGAÇÃO
const menuLinks = document.querySelectorAll('.nav-links li'); // <-- ESTA LINHA FALTAVA!
const sectionMap = {
    'inicio': document.getElementById('section-inicio'),
    'academias': document.getElementById('section-academias'),
    'detalhes-academia': document.getElementById('section-detalhes-academia'),
    'professores': document.getElementById('section-professores') // Nova aba global
};

menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        menuLinks.forEach(item => item.classList.remove('active'));
        link.classList.add('active');
        Object.values(sectionMap).forEach(section => section.style.display = 'none');
        const target = link.getAttribute('data-target');
        if (sectionMap[target]) {
            sectionMap[target].style.display = 'block';
            document.getElementById('page-title').textContent = link.textContent.trim();
        }
    });
});

document.getElementById('btn-voltar-academias').addEventListener('click', () => {
    document.querySelector('[data-target="academias"]').click(); 
});

// 3. MÁSCARAS (CNPJ, Telefone, CEP)
document.getElementById('acad-cnpj').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 14) v = v.substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/,"$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/,".$1/$2");
    v = v.replace(/(\d{4})(\d)/,"$1-$2");
    e.target.value = v;
});

document.getElementById('acad-telefone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g,"($1) $2");
    v = v.replace(/(\d)(\d{4})$/,"$1-$2");
    e.target.value = v;
});

document.getElementById('acad-cep').addEventListener('input', async (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 8) v = v.substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/,"$1-$2");
    e.target.value = v;

    if (v.length === 9) { 
        try {
            const res = await fetch(`https://viacep.com.br/ws/${v.replace('-', '')}/json/`);
            const data = await res.json();
            if (!data.erro) {
                document.getElementById('acad-endereco').value = data.logradouro + ', ';
                document.getElementById('acad-bairro').value = data.bairro;
                document.getElementById('acad-uf').value = data.uf;
                document.getElementById('acad-endereco').focus(); 
            }
        } catch (e) { console.error(e); }
    }
});

// 4. GESTÃO DE ACADEMIAS (CRUD)
const modalNovaAcademia = document.getElementById('modal-nova-academia');
const formNovaAcademia = document.getElementById('form-nova-academia');

document.getElementById('btn-nova-academia').addEventListener('click', () => {
    modoEdicao = false; idAcademiaEditando = null;
    document.querySelector('#modal-nova-academia h2').textContent = 'Cadastrar Academia';
    formNovaAcademia.querySelector('button[type="submit"]').textContent = 'Salvar Academia';
    formNovaAcademia.reset();
    modalNovaAcademia.style.display = 'flex';
});

document.getElementById('fechar-modal').addEventListener('click', () => modalNovaAcademia.style.display = 'none');

formNovaAcademia.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = formNovaAcademia.querySelector('button[type="submit"]');
    btnSubmit.textContent = "A processar..."; btnSubmit.disabled = true;

    try {
        const dadosAcademia = {
            nome: document.getElementById('acad-nome').value,
            cnpj: document.getElementById('acad-cnpj').value,
            cep: document.getElementById('acad-cep').value,
            endereco: document.getElementById('acad-endereco').value,
            bairro: document.getElementById('acad-bairro').value,
            uf: document.getElementById('acad-uf').value.toUpperCase(),
            emailGestor: document.getElementById('acad-email').value,
            telefoneResponsavel: document.getElementById('acad-telefone').value,
            licencasTotais: parseInt(document.getElementById('acad-licencas').value),
        };

        if (modoEdicao) {
            await updateDoc(doc(db, "academias", idAcademiaEditando), dadosAcademia);
        } else {
            dadosAcademia.licencasUsadas = 0;
            dadosAcademia.dataCadastro = serverTimestamp();
            await addDoc(collection(db, "academias"), dadosAcademia);
        }
        modalNovaAcademia.style.display = 'none'; 
        carregarAcademias(); 
    } catch (error) { console.error(error); alert("Erro ao salvar.");
    } finally { btnSubmit.textContent = "Salvar Academia"; btnSubmit.disabled = false; }
});

async function carregarAcademias() {
    const tbody = document.getElementById('table-academias-body');
    const totalGymsEl = document.getElementById('total-gyms');
    
    try {
        const querySnapshot = await getDocs(collection(db, "academias"));
        totalGymsEl.textContent = querySnapshot.size;
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #aaa;">Nenhuma academia.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const acad = docSnap.data();
            const id = docSnap.id; 
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td style="font-weight: bold;">${acad.nome}</td>
                <td>${acad.emailGestor}</td>
                <td><span style="color: #00e676;">${acad.licencasUsadas}</span> / ${acad.licencasTotais}</td>
                <td>
                    <button class="action-btn btn-view" title="Ver Detalhes"><span class="material-symbols-outlined" style="font-size: 18px;">visibility</span></button>
                    <button class="action-btn btn-edit" title="Editar"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span></button>
                    <button class="action-btn btn-delete" style="color: #ff5252;" title="Excluir"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </td>
            `;
            
            tr.querySelector('.btn-view').addEventListener('click', () => abrirDetalhesAcademia(acad, id));
            tr.querySelector('.btn-edit').addEventListener('click', () => abrirModalEdicao(acad, id));
            tr.querySelector('.btn-delete').addEventListener('click', () => deletarAcademia(id, acad.nome));
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

function abrirDetalhesAcademia(acad, id) {
    academiaAtualId = id;
    academiaAtualLicencasTotais = acad.licencasTotais || 0;
    academiaAtualLicencasUsadas = acad.licencasUsadas || 0;

    document.getElementById('detalhe-nome-titulo').textContent = acad.nome;
    document.getElementById('detalhe-cnpj').textContent = acad.cnpj || '--';
    document.getElementById('detalhe-email').textContent = acad.emailGestor || '--';
    document.getElementById('detalhe-telefone').textContent = acad.telefoneResponsavel || '--';
    document.getElementById('detalhe-cep').textContent = acad.cep || '--';
    document.getElementById('detalhe-endereco').textContent = `${acad.endereco || ''} - ${acad.bairro || ''}, ${acad.uf || ''}`;
    document.getElementById('detalhe-licencas').textContent = `${academiaAtualLicencasUsadas} de ${academiaAtualLicencasTotais} em uso`;
    
    if (acad.dataCadastro) document.getElementById('detalhe-data').textContent = acad.dataCadastro.toDate().toLocaleDateString('pt-BR');

    Object.values(sectionMap).forEach(section => section.style.display = 'none');
    document.getElementById('section-detalhes-academia').style.display = 'block';
    document.getElementById('page-title').textContent = "Detalhes da Academia";
    menuLinks.forEach(item => item.classList.remove('active')); 

    carregarProfessores(); 
}

function abrirModalEdicao(acad, id) {
    modoEdicao = true; idAcademiaEditando = id;
    document.querySelector('#modal-nova-academia h2').textContent = 'Editar Academia';
    formNovaAcademia.querySelector('button[type="submit"]').textContent = 'Atualizar Academia';

    document.getElementById('acad-nome').value = acad.nome || '';
    document.getElementById('acad-cnpj').value = acad.cnpj || '';
    document.getElementById('acad-cep').value = acad.cep || '';
    document.getElementById('acad-endereco').value = acad.endereco || '';
    document.getElementById('acad-bairro').value = acad.bairro || '';
    document.getElementById('acad-uf').value = acad.uf || '';
    document.getElementById('acad-email').value = acad.emailGestor || '';
    document.getElementById('acad-telefone').value = acad.telefoneResponsavel || '';
    document.getElementById('acad-licencas').value = acad.licencasTotais || '';

    modalNovaAcademia.style.display = 'flex';
}

// 5. EXCLUSÃO DE ACADEMIAS
const modalExclusao = document.getElementById('modal-confirmar-exclusao');
let idAcademiaParaExcluir = null;

function deletarAcademia(id, nome) {
    idAcademiaParaExcluir = id;
    document.getElementById('texto-confirmacao-exclusao').innerHTML = `Tem a certeza que deseja excluir a academia <strong>"${nome}"</strong>?<br>Esta ação não pode ser desfeita.`;
    modalExclusao.style.display = 'flex';
}

document.getElementById('btn-cancelar-exclusao').addEventListener('click', () => modalExclusao.style.display = 'none');
document.getElementById('btn-confirmar-exclusao').addEventListener('click', async () => {
    if (!idAcademiaParaExcluir) return;
    const btnConf = document.getElementById('btn-confirmar-exclusao');
    btnConf.textContent = "A excluir..."; btnConf.disabled = true;

    try {
        await deleteDoc(doc(db, "academias", idAcademiaParaExcluir));
        modalExclusao.style.display = 'none';
        carregarAcademias(); 
    } catch (error) { console.error(error); alert("Erro ao excluir.");
    } finally { btnConf.textContent = "Sim, Excluir"; btnConf.disabled = false; }
});

// Fechar modais clicando fora
window.addEventListener('click', (e) => {
    if (e.target === modalExclusao) modalExclusao.style.display = 'none';
    if (e.target === document.getElementById('modal-novo-professor')) document.getElementById('modal-novo-professor').style.display = 'none';
});

// 6. GESTÃO DE PROFESSORES (Na Academia)
const modalNovoProfessor = document.getElementById('modal-novo-professor');
const formNovoProfessor = document.getElementById('form-novo-professor');

document.getElementById('btn-adicionar-professor').addEventListener('click', () => {
    if (academiaAtualLicencasUsadas >= academiaAtualLicencasTotais) {
        alert("Limite de licenças atingido! Aumente o plano da academia para adicionar mais professores.");
        return;
    }
    formNovoProfessor.reset();
    modalNovoProfessor.style.display = 'flex';
});

document.getElementById('fechar-modal-professor').addEventListener('click', () => modalNovoProfessor.style.display = 'none');

formNovoProfessor.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = formNovoProfessor.querySelector('button[type="submit"]');
    btnSubmit.textContent = "A salvar..."; btnSubmit.disabled = true;

    const emailProf = document.getElementById('prof-email').value.trim().toLowerCase();

    try {
        await addDoc(collection(db, "academias", academiaAtualId, "professores"), {
            email: emailProf,
            dataVinculo: serverTimestamp(),
            status: "Pendente" 
        });

        await updateDoc(doc(db, "academias", academiaAtualId), {
            licencasUsadas: increment(1)
        });

        academiaAtualLicencasUsadas++;
        document.getElementById('detalhe-licencas').textContent = `${academiaAtualLicencasUsadas} de ${academiaAtualLicencasTotais} em uso`;
        
        modalNovoProfessor.style.display = 'none';
        carregarProfessores(); 
        carregarAcademias(); 

    } catch (error) { console.error(error); alert("Erro ao adicionar o professor.");
    } finally { btnSubmit.textContent = "Conceder Licença"; btnSubmit.disabled = false; }
});

async function carregarProfessores() {
    const tbody = document.getElementById('table-professores-body');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #aaa;">A carregar dados...</td></tr>';

    try {
        const profsSnapshot = await getDocs(collection(db, "academias", academiaAtualId, "professores"));
        tbody.innerHTML = '';

        if (profsSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #aaa;">Nenhum professor vinculado.</td></tr>';
            return;
        }

        profsSnapshot.forEach((docSnap) => {
            const prof = docSnap.data();
            const profId = docSnap.id;
            const tr = document.createElement('tr');
            
            const statusColor = prof.status === 'Pendente' ? '#ff9800' : '#00e676';
            
            tr.innerHTML = `
                <td><strong>${prof.email}</strong></td>
                <td><span style="color: ${statusColor}; border: 1px solid ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${prof.status}</span></td>
                <td>
                    <button class="action-btn btn-delete-prof" style="color: #ff5252;" title="Remover Licença">
                        <span class="material-symbols-outlined" style="font-size: 18px;">person_remove</span>
                    </button>
                </td>
            `;
            
            tr.querySelector('.btn-delete-prof').addEventListener('click', async () => {
                if(confirm(`Remover o acesso Premium de ${prof.email} e libertar a licença para a academia?`)) {
                    try {
                        await deleteDoc(doc(db, "academias", academiaAtualId, "professores", profId));
                        await updateDoc(doc(db, "academias", academiaAtualId), { licencasUsadas: increment(-1) });
                        
                        academiaAtualLicencasUsadas--;
                        document.getElementById('detalhe-licencas').textContent = `${academiaAtualLicencasUsadas} de ${academiaAtualLicencasTotais} em uso`;
                        carregarProfessores();
                        carregarAcademias();
                    } catch (e) { console.error("Erro ao remover professor", e); }
                }
            });

            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// 7. VISÃO GLOBAL DE PROFESSORES
async function carregarTodosProfessores() {
    const tbody = document.getElementById('table-todos-professores-body');
    const totalProfsEl = document.getElementById('total-profs');
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #aaa;">A carregar professores...</td></tr>';

    try {
        const q = query(collection(db, "users"), where("role", "==", "professor"));
        const querySnapshot = await getDocs(q);
        
        tbody.innerHTML = '';
        let contagemPremium = 0;

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #aaa;">Nenhum professor registado na aplicação.</td></tr>';
            totalProfsEl.textContent = "0";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const prof = docSnap.data();
            const tr = document.createElement('tr');
            
            let vinculoHtml = '<span style="color: #aaa; font-style: italic;">Autônomo</span>';
            if (prof.academiaNome) {
                vinculoHtml = `<span style="color: #00e676; font-weight: 500;">${prof.academiaNome}</span>`;
            } else if (prof.academiaId) {
                vinculoHtml = `<span style="color: #00e676; font-weight: 500;">Vinculado</span>`; 
            }

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
                <td>
                    <button class="action-btn" title="Ver Detalhes"><span class="material-symbols-outlined" style="font-size: 18px;">visibility</span></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        totalProfsEl.textContent = contagemPremium.toString();

    } catch (error) {
        console.error("Erro ao buscar visão global de professores:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5252;">Erro ao carregar a lista.</td></tr>';
    }
}