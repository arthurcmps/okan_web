import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTANTE: Adicionámos updateDoc e deleteDoc na lista abaixo
import { getFirestore, doc, getDoc, collection, addDoc, getDocs, serverTimestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const adminNameEl = document.getElementById('admin-name');
const logoutBtn = document.getElementById('logout-btn');

// VARIÁVEIS DE CONTROLO DE EDIÇÃO
let modoEdicao = false;
let idAcademiaEditando = null;

// 1. Auth Guard (Segurança)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && (docSnap.data().role === 'super_admin' || docSnap.data().role === 'gym_admin')) {
                adminNameEl.textContent = docSnap.data().name || user.email;
                carregarAcademias(); 
            } else {
                alert("Acesso Negado.");
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) { console.error(error); }
    } else { window.location.href = "index.html"; }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// 2. Navegação
const menuLinks = document.querySelectorAll('.nav-links li');
const sectionMap = {
    'inicio': document.getElementById('section-inicio'),
    'academias': document.getElementById('section-academias'),
    'detalhes-academia': document.getElementById('section-detalhes-academia')
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

// 3. Modal (Abertura para Nova Academia)
const modalNovaAcademia = document.getElementById('modal-nova-academia');
const formNovaAcademia = document.getElementById('form-nova-academia');

document.getElementById('btn-nova-academia').addEventListener('click', () => {
    modoEdicao = false;
    idAcademiaEditando = null;
    document.querySelector('#modal-nova-academia h2').textContent = 'Cadastrar Academia';
    formNovaAcademia.querySelector('button[type="submit"]').textContent = 'Salvar Academia';
    formNovaAcademia.reset();
    modalNovaAcademia.style.display = 'flex';
});

document.getElementById('fechar-modal').addEventListener('click', () => modalNovaAcademia.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === modalNovaAcademia) modalNovaAcademia.style.display = 'none';
});

// 4. MÁSCARAS E CEP AUTOMÁTICO
const inputCnpj = document.getElementById('acad-cnpj');
const inputTelefone = document.getElementById('acad-telefone');
const inputCep = document.getElementById('acad-cep');

inputCnpj.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 14) v = v.substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/,"$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/,".$1/$2");
    v = v.replace(/(\d{4})(\d)/,"$1-$2");
    e.target.value = v;
});

inputTelefone.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g,"($1) $2");
    v = v.replace(/(\d)(\d{4})$/,"$1-$2");
    e.target.value = v;
});

inputCep.addEventListener('input', async (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 8) v = v.substring(0, 8);
    v = v.replace(/^(\d{5})(\d)/,"$1-$2");
    e.target.value = v;

    if (v.length === 9) { 
        const cepLimpo = v.replace('-', '');
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await response.json();
            if (!data.erro) {
                document.getElementById('acad-endereco').value = data.logradouro + ', ';
                document.getElementById('acad-bairro').value = data.bairro;
                document.getElementById('acad-uf').value = data.uf;
                document.getElementById('acad-endereco').focus(); 
            }
        } catch (error) { console.error(error); }
    }
});

// 5. Salvar ou Atualizar no Firebase
formNovaAcademia.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = formNovaAcademia.querySelector('button[type="submit"]');
    btnSubmit.textContent = "A processar..."; btnSubmit.disabled = true;

    try {
        // Objeto com os dados do formulário
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
            // Se estiver a editar, atualiza o documento existente
            const docRef = doc(db, "academias", idAcademiaEditando);
            await updateDoc(docRef, dadosAcademia);
        } else {
            // Se for nova, cria do zero
            dadosAcademia.licencasUsadas = 0;
            dadosAcademia.dataCadastro = serverTimestamp();
            await addDoc(collection(db, "academias"), dadosAcademia);
        }

        modalNovaAcademia.style.display = 'none'; 
        formNovaAcademia.reset();
        carregarAcademias(); 
    } catch (error) { 
        console.error(error); alert("Erro ao salvar.");
    } finally { 
        btnSubmit.textContent = "Salvar Academia"; 
        btnSubmit.disabled = false; 
    }
});

// 6. Carregar e Mostrar na Tabela
async function carregarAcademias() {
    const tbody = document.getElementById('table-academias-body');
    const totalGymsEl = document.getElementById('total-gyms');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #aaa;">A carregar...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "academias"));
        totalGymsEl.textContent = querySnapshot.size;
        tbody.innerHTML = '';

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #aaa;">Nenhuma academia.</td></tr>';
            return;
        }

        // Alterámos 'doc' para 'documento' para não dar conflito com a função doc() do Firebase
        querySnapshot.forEach((documento) => {
            const acad = documento.data();
            const id = documento.id; // Precisamos do ID para poder editar e apagar!
            
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
            
            // Adicionando as ações aos botões
            tr.querySelector('.btn-view').addEventListener('click', () => abrirDetalhesAcademia(acad));
            tr.querySelector('.btn-edit').addEventListener('click', () => abrirModalEdicao(acad, id));
            tr.querySelector('.btn-delete').addEventListener('click', () => deletarAcademia(id, acad.nome));
            
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// 7. Função Abrir Detalhes
function abrirDetalhesAcademia(acad) {
    document.getElementById('detalhe-nome-titulo').textContent = acad.nome;
    document.getElementById('detalhe-cnpj').textContent = acad.cnpj || '--';
    document.getElementById('detalhe-email').textContent = acad.emailGestor || '--';
    document.getElementById('detalhe-telefone').textContent = acad.telefoneResponsavel || '--';
    document.getElementById('detalhe-cep').textContent = acad.cep || '--';
    document.getElementById('detalhe-endereco').textContent = `${acad.endereco || ''} - ${acad.bairro || ''}, ${acad.uf || ''}`;
    document.getElementById('detalhe-licencas').textContent = `${acad.licencasUsadas || 0} de ${acad.licencasTotais || 0}`;
    
    if (acad.dataCadastro) {
        document.getElementById('detalhe-data').textContent = acad.dataCadastro.toDate().toLocaleDateString('pt-BR');
    }

    Object.values(sectionMap).forEach(section => section.style.display = 'none');
    document.getElementById('section-detalhes-academia').style.display = 'block';
    document.getElementById('page-title').textContent = "Detalhes da Academia";
    menuLinks.forEach(item => item.classList.remove('active')); 
}

// 8. Função Abrir Modal para EDIÇÃO (Novidade)
function abrirModalEdicao(acad, id) {
    modoEdicao = true;
    idAcademiaEditando = id;

    // Muda o título e o botão
    document.querySelector('#modal-nova-academia h2').textContent = 'Editar Academia';
    formNovaAcademia.querySelector('button[type="submit"]').textContent = 'Atualizar Academia';

    // Preenche os campos com os dados existentes
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

// 9. Função DELETAR Academia (Novidade)
async function deletarAcademia(id, nome) {
    // Alerta de segurança nativo do navegador
    const confirmacao = confirm(`Tem a certeza que deseja excluir a academia "${nome}"?\nEsta ação não pode ser desfeita e removerá os acessos associados.`);
    
    if (confirmacao) {
        try {
            await deleteDoc(doc(db, "academias", id));
            carregarAcademias(); // Atualiza a tabela imediatamente
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Não foi possível excluir a academia. Tente novamente.");
        }
    }
}