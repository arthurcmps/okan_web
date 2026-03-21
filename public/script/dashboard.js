import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, addDoc, getDocs, serverTimestamp, updateDoc, deleteDoc, increment, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRbLUy03Y7628Lv3ruMy5PDq0Y3_zwykw",
  authDomain: "app-academia-2914d.firebaseapp.com",
  projectId: "app-academia-2914d",
  storageBucket: "app-academia-2914d.firebasestorage.app",
  messagingSenderId: "1080333508962",
  appId: "1:1080333508962:web:e93dccc19e32aaaf4ccc3b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const adminNameEl = document.getElementById('admin-name');

// =========================================================
// 1. SISTEMA DE EXCLUSÃO UNIVERSAL (Modal Bonito)
// =========================================================
const modalExclusao = document.getElementById('modal-confirmar-exclusao');
const textoConfirmacao = document.getElementById('texto-confirmacao-exclusao');
let acaoExclusaoPendente = null; // Guarda a função que deve ser executada

// Função mágica que recebe o texto e o que deve fazer se o user disser SIM
function confirmarExclusao(mensagemHtml, acaoConfirmada) {
    textoConfirmacao.innerHTML = mensagemHtml;
    acaoExclusaoPendente = acaoConfirmada;
    modalExclusao.style.display = 'flex';
}

document.getElementById('btn-cancelar-exclusao').addEventListener('click', () => {
    modalExclusao.style.display = 'none';
    acaoExclusaoPendente = null;
});

document.getElementById('btn-confirmar-exclusao').addEventListener('click', async () => {
    if (!acaoExclusaoPendente) return;
    const btnConf = document.getElementById('btn-confirmar-exclusao');
    btnConf.textContent = "A processar..."; btnConf.disabled = true;

    try {
        await acaoExclusaoPendente(); // Executa a função guardada
        modalExclusao.style.display = 'none';
    } catch (error) { 
        console.error("Erro na exclusão:", error); 
        alert("Ocorreu um erro ao processar a exclusão.");
    } finally { 
        btnConf.textContent = "Sim, Confirmar"; btnConf.disabled = false; 
        acaoExclusaoPendente = null;
    }
});


// =========================================================
// 2. SEGURANÇA E NAVEGAÇÃO
// =========================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && (docSnap.data().role === 'super_admin' || docSnap.data().role === 'gym_admin')) {
                adminNameEl.textContent = docSnap.data().name || user.email;
                carregarAcademias();
                carregarTodosProfessores();
                carregarTemplatesLoja(); 
            } else {
                alert("Acesso Negado.");
                await signOut(auth);
                window.location.href = "index.html";
            }
        } catch (error) { console.error(error); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth); window.location.href = "index.html";
});

const menuLinks = document.querySelectorAll('.nav-links li');
const sectionMap = {
    'inicio': document.getElementById('section-inicio'),
    'academias': document.getElementById('section-academias'),
    'detalhes-academia': document.getElementById('section-detalhes-academia'),
    'professores': document.getElementById('section-professores'),
    'templates': document.getElementById('section-templates')
};

menuLinks.forEach(link => {
    link.addEventListener('click', () => {
        menuLinks.forEach(item => item.classList.remove('active'));
        link.classList.add('active');
        Object.values(sectionMap).forEach(section => { if(section) section.style.display = 'none'; });
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


// =========================================================
// 3. MÁSCARAS
// =========================================================
document.getElementById('acad-cnpj').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 14) v = v.substring(0, 14);
    v = v.replace(/^(\d{2})(\d)/,"$1.$2"); v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/,".$1/$2"); v = v.replace(/(\d{4})(\d)/,"$1-$2");
    e.target.value = v;
});

document.getElementById('acad-telefone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g,"");
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g,"($1) $2"); v = v.replace(/(\d)(\d{4})$/,"$1-$2");
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


// =========================================================
// 4. ACADEMIAS E PROFESSORES (Usando o Novo Modal de Exclusão)
// =========================================================
let modoEdicaoAcademia = false;
let idAcademiaEditando = null;
let academiaAtualId = null; 
let academiaAtualLicencasTotais = 0;
let academiaAtualLicencasUsadas = 0;

const modalNovaAcademia = document.getElementById('modal-nova-academia');
const formNovaAcademia = document.getElementById('form-nova-academia');

document.getElementById('btn-nova-academia').addEventListener('click', () => {
    modoEdicaoAcademia = false; idAcademiaEditando = null;
    document.getElementById('titulo-modal-academia').textContent = 'Cadastrar Academia';
    document.getElementById('btn-salvar-academia').textContent = 'Salvar Academia';
    formNovaAcademia.reset();
    modalNovaAcademia.style.display = 'flex';
});

document.getElementById('fechar-modal-academia').addEventListener('click', () => modalNovaAcademia.style.display = 'none');

formNovaAcademia.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-salvar-academia');
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

        if (modoEdicaoAcademia) {
            await updateDoc(doc(db, "academias", idAcademiaEditando), dadosAcademia);
        } else {
            dadosAcademia.licencasUsadas = 0;
            dadosAcademia.dataCadastro = serverTimestamp();
            await addDoc(collection(db, "academias"), dadosAcademia);
        }
        modalNovaAcademia.style.display = 'none'; 
        carregarAcademias(); 
    } catch (error) { console.error(error); alert("Erro ao salvar.");
    } finally { btnSubmit.textContent = "Salvar"; btnSubmit.disabled = false; }
});

async function carregarAcademias() {
    const tbody = document.getElementById('table-academias-body');
    try {
        const querySnapshot = await getDocs(collection(db, "academias"));
        document.getElementById('total-gyms').textContent = querySnapshot.size;
        tbody.innerHTML = '';
        if (querySnapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #aaa;">Nenhuma academia.</td></tr>'; return; }

        querySnapshot.forEach((docSnap) => {
            const acad = docSnap.data(); const id = docSnap.id; 
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold;">${acad.nome}</td><td>${acad.emailGestor}</td>
                <td><span style="color: #00e676;">${acad.licencasUsadas}</span> / ${acad.licencasTotais}</td>
                <td>
                    <button class="action-btn btn-view" title="Ver Detalhes"><span class="material-symbols-outlined" style="font-size: 18px;">visibility</span></button>
                    <button class="action-btn btn-edit" title="Editar"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span></button>
                    <button class="action-btn btn-delete" style="color: #ff5252;" title="Excluir"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </td>
            `;
            
            tr.querySelector('.btn-view').addEventListener('click', () => abrirDetalhesAcademia(acad, id));
            tr.querySelector('.btn-edit').addEventListener('click', () => {
                modoEdicaoAcademia = true; idAcademiaEditando = id;
                document.getElementById('titulo-modal-academia').textContent = 'Editar Academia';
                document.getElementById('btn-salvar-academia').textContent = 'Atualizar Academia';
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
            });
            
            // USO DO NOVO MOTOR DE EXCLUSÃO
            tr.querySelector('.btn-delete').addEventListener('click', () => {
                confirmarExclusao(
                    `Tem a certeza que deseja excluir a academia <strong>"${acad.nome}"</strong>?<br>Esta ação não pode ser desfeita e os acessos serão removidos.`,
                    async () => {
                        await deleteDoc(doc(db, "academias", id));
                        carregarAcademias();
                    }
                );
            });
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

function abrirDetalhesAcademia(acad, id) {
    academiaAtualId = id; academiaAtualLicencasTotais = acad.licencasTotais || 0; academiaAtualLicencasUsadas = acad.licencasUsadas || 0;
    document.getElementById('detalhe-nome-titulo').textContent = acad.nome;
    document.getElementById('detalhe-cnpj').textContent = acad.cnpj || '--';
    document.getElementById('detalhe-email').textContent = acad.emailGestor || '--';
    document.getElementById('detalhe-telefone').textContent = acad.telefoneResponsavel || '--';
    document.getElementById('detalhe-cep').textContent = acad.cep || '--';
    document.getElementById('detalhe-endereco').textContent = `${acad.endereco || ''} - ${acad.bairro || ''}, ${acad.uf || ''}`;
    document.getElementById('detalhe-licencas').textContent = `${academiaAtualLicencasUsadas} de ${academiaAtualLicencasTotais} em uso`;
    if (acad.dataCadastro) document.getElementById('detalhe-data').textContent = acad.dataCadastro.toDate().toLocaleDateString('pt-BR');

    Object.values(sectionMap).forEach(section => { if(section) section.style.display = 'none'; });
    document.getElementById('section-detalhes-academia').style.display = 'block';
    document.getElementById('page-title').textContent = "Detalhes da Academia";
    menuLinks.forEach(item => item.classList.remove('active')); 
    carregarProfessoresDaAcademia(); 
}

// Professores da Academia
const modalNovoProfessor = document.getElementById('modal-novo-professor');
document.getElementById('btn-adicionar-professor').addEventListener('click', () => {
    if (academiaAtualLicencasUsadas >= academiaAtualLicencasTotais) { alert("Limite de licenças atingido!"); return; }
    document.getElementById('form-novo-professor').reset();
    modalNovoProfessor.style.display = 'flex';
});
document.getElementById('fechar-modal-professor').addEventListener('click', () => modalNovoProfessor.style.display = 'none');

document.getElementById('form-novo-professor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.querySelector('#form-novo-professor button');
    btnSubmit.textContent = "A salvar..."; btnSubmit.disabled = true;
    try {
        const emailProf = document.getElementById('prof-email').value.trim().toLowerCase();
        await addDoc(collection(db, "academias", academiaAtualId, "professores"), { email: emailProf, dataVinculo: serverTimestamp(), status: "Pendente" });
        await updateDoc(doc(db, "academias", academiaAtualId), { licencasUsadas: increment(1) });
        academiaAtualLicencasUsadas++;
        document.getElementById('detalhe-licencas').textContent = `${academiaAtualLicencasUsadas} de ${academiaAtualLicencasTotais} em uso`;
        modalNovoProfessor.style.display = 'none';
        carregarProfessoresDaAcademia(); carregarAcademias(); 
    } catch (error) { console.error(error); alert("Erro ao adicionar.");
    } finally { btnSubmit.textContent = "Conceder Licença"; btnSubmit.disabled = false; }
});

async function carregarProfessoresDaAcademia() {
    const tbody = document.getElementById('table-professores-body');
    try {
        const profsSnapshot = await getDocs(collection(db, "academias", academiaAtualId, "professores"));
        tbody.innerHTML = '';
        if (profsSnapshot.empty) { tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #aaa;">Nenhum professor vinculado.</td></tr>'; return; }

        profsSnapshot.forEach((docSnap) => {
            const prof = docSnap.data(); const profId = docSnap.id;
            const tr = document.createElement('tr');
            const statusColor = prof.status === 'Pendente' ? '#ff9800' : '#00e676';
            tr.innerHTML = `
                <td><strong>${prof.email}</strong></td>
                <td><span style="color: ${statusColor}; border: 1px solid ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${prof.status}</span></td>
                <td><button class="action-btn btn-delete-prof" style="color: #ff5252;" title="Remover Licença"><span class="material-symbols-outlined" style="font-size: 18px;">person_remove</span></button></td>
            `;
            // USO DO NOVO MOTOR DE EXCLUSÃO PARA PROFESSORES
            tr.querySelector('.btn-delete-prof').addEventListener('click', async () => {
                confirmarExclusao(
                    `Remover o acesso Premium de <strong>${prof.email}</strong> e libertar a licença para a academia?`,
                    async () => {
                        await deleteDoc(doc(db, "academias", academiaAtualId, "professores", profId));
                        await updateDoc(doc(db, "academias", academiaAtualId), { licencasUsadas: increment(-1) });
                        academiaAtualLicencasUsadas--;
                        document.getElementById('detalhe-licencas').textContent = `${academiaAtualLicencasUsadas} de ${academiaAtualLicencasTotais} em uso`;
                        carregarProfessoresDaAcademia(); carregarAcademias();
                    }
                );
            });
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// Professores Global
async function carregarTodosProfessores() {
    const tbody = document.getElementById('table-todos-professores-body');
    try {
        const q = query(collection(db, "users"), where("role", "==", "professor"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        let contagemPremium = 0;
        if (snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #aaa;">Nenhum professor.</td></tr>'; document.getElementById('total-profs').textContent = "0"; return; }

        snapshot.forEach((docSnap) => {
            const prof = docSnap.data();
            const tr = document.createElement('tr');
            let vinculoHtml = '<span style="color: #aaa; font-style: italic;">Autônomo</span>';
            if (prof.academiaNome) vinculoHtml = `<span style="color: #00e676; font-weight: 500;">${prof.academiaNome}</span>`;
            else if (prof.academiaId) vinculoHtml = `<span style="color: #00e676; font-weight: 500;">Vinculado</span>`; 

            let premiumHtml = '<span style="color: #aaa; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Gratuito</span>';
            if (prof.isPremium) { contagemPremium++; premiumHtml = '<span style="color: #00e676; border: 1px solid #00e676; background: rgba(0, 230, 118, 0.1); padding: 4px 8px; border-radius: 4px; font-size: 12px;">Premium</span>'; }
            
            tr.innerHTML = `
                <td style="font-weight: bold;">${prof.name || 'Sem nome'}</td><td>${prof.email}</td><td>${vinculoHtml}</td><td>${premiumHtml}</td>
                <td><button class="action-btn" title="Ver Detalhes"><span class="material-symbols-outlined" style="font-size: 18px;">visibility</span></button></td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('total-profs').textContent = contagemPremium.toString();
    } catch (error) { console.error(error); }
}


// =========================================================
// 5. LOJA OFICIAL E TEMPLATES (Adicionar, Editar e Excluir)
// =========================================================
let idTemplateEditando = null;
let exerciciosDoTemplateAtual = []; 
const tagsDisponiveis = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Iniciante', 'Intermediário', 'Avançado', 'Casa', 'Academia', 'Sem Impacto'];

// Gerar as Tags no HTML do Modal
const tagsContainer = document.getElementById('tpl-tags-container');
tagsDisponiveis.forEach(tag => {
    const label = document.createElement('label');
    label.className = 'tag-chip';
    label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
    label.addEventListener('change', (e) => { e.target.checked ? label.classList.add('selected') : label.classList.remove('selected'); });
    tagsContainer.appendChild(label);
});

// ABRIR MODAL PARA NOVO TEMPLATE
const modalTemplate = document.getElementById('modal-template-builder');
document.getElementById('btn-novo-template').addEventListener('click', () => {
    idTemplateEditando = null;
    exerciciosDoTemplateAtual = [];
    document.getElementById('titulo-modal-template').textContent = 'Novo Produto';
    document.getElementById('btn-salvar-template').textContent = 'Salvar na Loja';
    document.getElementById('tpl-nome').value = '';
    document.getElementById('tpl-preco').value = '0.00';
    
    document.querySelectorAll('.tag-chip input').forEach(input => { input.checked = false; input.parentElement.classList.remove('selected'); });
    atualizarListaExerciciosUI();
    modalTemplate.style.display = 'flex';
});

document.getElementById('fechar-modal-template').addEventListener('click', () => modalTemplate.style.display = 'none');

// SALVAR OU ATUALIZAR TEMPLATE
document.getElementById('btn-salvar-template').addEventListener('click', async () => {
    const nome = document.getElementById('tpl-nome').value.trim();
    if(!nome || exerciciosDoTemplateAtual.length === 0) { alert("Preencha o nome e adicione pelo menos 1 exercício."); return; }

    const preco = parseFloat(document.getElementById('tpl-preco').value) || 0.0;
    const tagsSelecionadas = Array.from(document.querySelectorAll('.tag-chip input:checked')).map(cb => cb.value);

    const dataMap = {
        personalId: 'SYSTEM_ADMIN', 
        nome: nome,
        preco: preco,
        tags: tagsSelecionadas,
        exercicios: exerciciosDoTemplateAtual,
        isPremium: true
    };

    const btnSalvar = document.getElementById('btn-salvar-template');
    btnSalvar.textContent = "A salvar..."; btnSalvar.disabled = true;

    try {
        if (idTemplateEditando) {
            // Se estiver a editar, faz um update
            await updateDoc(doc(db, "workout_templates", idTemplateEditando), dataMap);
        } else {
            // Se for novo, faz um add e coloca o carimbo de tempo
            dataMap.timestamp = serverTimestamp();
            await addDoc(collection(db, "workout_templates"), dataMap);
        }
        modalTemplate.style.display = 'none';
        carregarTemplatesLoja();
    } catch (error) { console.error(error); alert("Erro ao salvar o template."); } 
    finally { btnSalvar.textContent = "Salvar na Loja"; btnSalvar.disabled = false; }
});

// LISTAR TEMPLATES NA TABELA
async function carregarTemplatesLoja() {
    const tbody = document.getElementById('table-templates-body');
    try {
        const q = query(collection(db, "workout_templates"), where("personalId", "==", "SYSTEM_ADMIN"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        if (snapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #aaa;">Nenhum produto na loja.</td></tr>'; return; }

        snapshot.forEach((documento) => {
            const tpl = documento.data(); const id = documento.id;
            const tr = document.createElement('tr');
            
            const precoStr = tpl.preco ? `R$ ${tpl.preco.toFixed(2)}` : 'Grátis';
            const tagsStr = (tpl.tags && tpl.tags.length > 0) ? tpl.tags.join(', ') : 'Sem tags';

            tr.innerHTML = `
                <td style="font-weight: bold;">${tpl.nome}</td>
                <td style="color: #ff5252;">${precoStr}</td>
                <td style="font-size: 12px; color: #aaa;">${tagsStr}</td>
                <td>
                    <button class="action-btn btn-edit-tpl" title="Editar Produto"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span></button>
                    <button class="action-btn btn-delete-tpl" style="color: #ff5252;" title="Excluir da Loja"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </td>
            `;

            // ABRIR EDIÇÃO
            tr.querySelector('.btn-edit-tpl').addEventListener('click', () => {
                idTemplateEditando = id;
                exerciciosDoTemplateAtual = [...(tpl.exercicios || [])];
                
                document.getElementById('titulo-modal-template').textContent = 'Editar Produto';
                document.getElementById('btn-salvar-template').textContent = 'Atualizar na Loja';
                document.getElementById('tpl-nome').value = tpl.nome || '';
                document.getElementById('tpl-preco').value = tpl.preco ? tpl.preco.toFixed(2) : '0.00';
                
                const tagsDoTpl = tpl.tags || [];
                document.querySelectorAll('.tag-chip input').forEach(input => {
                    if (tagsDoTpl.includes(input.value)) { input.checked = true; input.parentElement.classList.add('selected'); } 
                    else { input.checked = false; input.parentElement.classList.remove('selected'); }
                });

                atualizarListaExerciciosUI();
                modalTemplate.style.display = 'flex';
            });

            // USO DO NOVO MOTOR DE EXCLUSÃO PARA TEMPLATES
            tr.querySelector('.btn-delete-tpl').addEventListener('click', () => {
                confirmarExclusao(
                    `Remover o treino <strong>"${tpl.nome}"</strong> da loja oficial?<br>Os alunos que já compraram este treino continuarão a ter acesso.`,
                    async () => {
                        await deleteDoc(doc(db, "workout_templates", id));
                        carregarTemplatesLoja();
                    }
                );
            });
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// ---------------------------------------------------------
// CATÁLOGO DE EXERCÍCIOS DENTRO DO TEMPLATE
// ---------------------------------------------------------
const modalCatalogo = document.getElementById('modal-catalogo');
let exercicioSelecionadoTemporario = null;

document.getElementById('btn-abrir-catalogo').addEventListener('click', async () => {
    modalCatalogo.style.display = 'flex';
    const lista = document.getElementById('lista-catalogo');
    lista.innerHTML = '<p style="color: #aaa; text-align: center;">A buscar...</p>';
    try {
        const snapshot = await getDocs(collection(db, "exercises"));
        lista.innerHTML = '';
        if (snapshot.empty) { lista.innerHTML = '<p style="color: #aaa; text-align: center;">Nenhum exercício no banco de dados.</p>'; return; }
        
        snapshot.forEach(docSnap => {
            const ex = docSnap.data();
            const div = document.createElement('div');
            div.style.padding = '12px'; div.style.borderBottom = '1px solid #333'; div.style.cursor = 'pointer';
            div.innerHTML = `<strong style="color: white;">${ex.nome}</strong><br><span style="color: #aaa; font-size: 12px;">${ex.grupo || ''}</span>`;
            
            div.addEventListener('click', () => {
                exercicioSelecionadoTemporario = ex;
                modalCatalogo.style.display = 'none';
                document.getElementById('nome-exercicio-config').textContent = ex.nome;
                document.getElementById('modal-config-series').style.display = 'flex';
            });
            lista.appendChild(div);
        });
    } catch(e) { console.error(e); }
});

document.getElementById('fechar-modal-catalogo').addEventListener('click', () => modalCatalogo.style.display = 'none');

document.getElementById('btn-confirmar-exercicio').addEventListener('click', () => {
    exerciciosDoTemplateAtual.push({
        id: Date.now().toString(),
        nome: exercicioSelecionadoTemporario.nome,
        series: document.getElementById('config-series').value,
        repeticoes: document.getElementById('config-reps').value,
        videoUrl: exercicioSelecionadoTemporario.videoUrl || ""
    });
    document.getElementById('modal-config-series').style.display = 'none';
    atualizarListaExerciciosUI();
});

function atualizarListaExerciciosUI() {
    const ul = document.getElementById('lista-exercicios-template');
    ul.innerHTML = '';
    exerciciosDoTemplateAtual.forEach((ex, index) => {
        const li = document.createElement('li'); li.className = 'exercise-item';
        li.innerHTML = `
            <div class="exercise-item-info"><strong>${ex.nome}</strong><span>${ex.series}x ${ex.repeticoes}</span></div>
            <button class="action-btn" style="color: #ff5252;" onclick="removerExercicioDoTemplate(${index})"><span class="material-symbols-outlined">close</span></button>
        `;
        ul.appendChild(li);
    });
}
window.removerExercicioDoTemplate = function(index) {
    exerciciosDoTemplateAtual.splice(index, 1);
    atualizarListaExerciciosUI();
}

// Fechar modais genéricos clicando fora
window.addEventListener('click', (e) => {
    if (e.target === modalExclusao) modalExclusao.style.display = 'none';
    if (e.target === document.getElementById('modal-novo-professor')) document.getElementById('modal-novo-professor').style.display = 'none';
    if (e.target === modalTemplate) modalTemplate.style.display = 'none';
    if (e.target === modalCatalogo) modalCatalogo.style.display = 'none';
});