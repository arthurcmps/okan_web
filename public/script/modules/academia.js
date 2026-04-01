import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";

let userRole = null;
let currentUserEmail = null;
let confirmarExclusaoGlob = null;

let modoEdicaoAcademia = false;
let idAcademiaEditando = null;
let academiaAtualId = null; 
let academiaAtualLicencasTotais = 0;
let academiaAtualLicencasUsadas = 0;
let academiaAtualDados = null; 

// Função chamada pelo dashboard.js após o login
export function initAcademiasContext(role, email, fnExclusao) {
    userRole = role;
    currentUserEmail = email;
    confirmarExclusaoGlob = fnExclusao;
}

// Configuração inicial dos botões e máscaras
export function setupAcademiasUI() {
    // MÁSCARAS
    document.getElementById('acad-cnpj')?.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g,""); if (v.length > 14) v = v.substring(0, 14); v = v.replace(/^(\d{2})(\d)/,"$1.$2"); v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3"); v = v.replace(/\.(\d{3})(\d)/,".$1/$2"); v = v.replace(/(\d{4})(\d)/,"$1-$2"); e.target.value = v; });
    document.getElementById('acad-telefone')?.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g,""); if (v.length > 11) v = v.substring(0, 11); v = v.replace(/^(\d{2})(\d)/g,"($1) $2"); v = v.replace(/(\d)(\d{4})$/,"$1-$2"); e.target.value = v; });
    document.getElementById('acad-cep')?.addEventListener('input', async (e) => { let v = e.target.value.replace(/\D/g,""); if (v.length > 8) v = v.substring(0, 8); v = v.replace(/^(\d{5})(\d)/,"$1-$2"); e.target.value = v; if (v.length === 9) { try { const res = await fetch(`https://viacep.com.br/ws/${v.replace('-', '')}/json/`); const data = await res.json(); if (!data.erro) { document.getElementById('acad-endereco').value = data.logradouro + ', '; document.getElementById('acad-bairro').value = data.bairro; document.getElementById('acad-uf').value = data.uf; document.getElementById('acad-endereco').focus(); } } catch (e) { console.error(e); } } });

    // MODAIS DE ACADEMIA
    const modalNovaAcademia = document.getElementById('modal-nova-academia');
    const formNovaAcademia = document.getElementById('form-nova-academia');

    document.getElementById('btn-nova-academia')?.addEventListener('click', () => {
        modoEdicaoAcademia = false; idAcademiaEditando = null;
        document.getElementById('titulo-modal-academia').textContent = 'Cadastrar Academia';
        document.getElementById('btn-salvar-academia').textContent = 'Salvar Academia';
        
        const licInput = document.getElementById('acad-licencas');
        if(licInput) {
            licInput.disabled = false;
            document.getElementById('aviso-licencas').style.display = 'none';
        }
        formNovaAcademia.reset();
        modalNovaAcademia.style.display = 'flex';
    });

    document.getElementById('fechar-modal-academia')?.addEventListener('click', () => modalNovaAcademia.style.display = 'none');

    formNovaAcademia?.addEventListener('submit', async (e) => {
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
            };

            const licInput = document.getElementById('acad-licencas');
            if (licInput && !licInput.disabled && licInput.value) {
                dadosAcademia.licencasTotais = parseInt(licInput.value);
            }

            if (modoEdicaoAcademia) {
                await updateDoc(doc(db, "academias", idAcademiaEditando), dadosAcademia);
                if (userRole === 'gym_admin') configurarPainelAcademia(currentUserEmail);
                else {
                    carregarAcademias(); 
                    if(academiaAtualId === idAcademiaEditando) {
                        const docAtual = await getDoc(doc(db, "academias", idAcademiaEditando));
                        abrirDetalhesAcademia(docAtual.data(), docAtual.id);
                    }
                }
            } else {
                dadosAcademia.licencasUsadas = 0;
                dadosAcademia.dataCadastro = serverTimestamp();
                await addDoc(collection(db, "academias"), dadosAcademia);
                carregarAcademias();
            }
            modalNovaAcademia.style.display = 'none'; 
        } catch (error) { console.error(error); alert("Erro ao salvar.");
        } finally { btnSubmit.textContent = "Salvar Dados"; btnSubmit.disabled = false; }
    });

    document.getElementById('btn-editar-minha-academia')?.addEventListener('click', () => {
        if(!academiaAtualDados) return;
        modoEdicaoAcademia = true; idAcademiaEditando = academiaAtualId;
        document.getElementById('titulo-modal-academia').textContent = 'Editar Meus Dados';
        document.getElementById('btn-salvar-academia').textContent = 'Atualizar Dados';
        
        document.getElementById('acad-nome').value = academiaAtualDados.nome || '';
        document.getElementById('acad-cnpj').value = academiaAtualDados.cnpj || '';
        document.getElementById('acad-cep').value = academiaAtualDados.cep || '';
        document.getElementById('acad-endereco').value = academiaAtualDados.endereco || '';
        document.getElementById('acad-bairro').value = academiaAtualDados.bairro || '';
        document.getElementById('acad-uf').value = academiaAtualDados.uf || '';
        document.getElementById('acad-email').value = academiaAtualDados.emailGestor || '';
        document.getElementById('acad-telefone').value = academiaAtualDados.telefoneResponsavel || '';
        
        const licInput = document.getElementById('acad-licencas');
        if(licInput) {
            licInput.value = academiaAtualDados.licencasTotais || '';
            if (userRole === 'gym_admin') {
                licInput.disabled = true;
                document.getElementById('container-licencas').style.opacity = '0.6';
                document.getElementById('aviso-licencas').style.display = 'block';
            } else {
                licInput.disabled = false;
                document.getElementById('container-licencas').style.opacity = '1';
                document.getElementById('aviso-licencas').style.display = 'none';
            }
        }
        modalNovaAcademia.style.display = 'flex';
    });

    // PROFESSORES DA ACADEMIA
    const modalNovoProfessor = document.getElementById('modal-novo-professor');
    document.getElementById('btn-adicionar-professor')?.addEventListener('click', () => {
        if (academiaAtualLicencasUsadas >= academiaAtualLicencasTotais) { alert("Limite de licenças atingido! Compre mais no separador de Planos para adicionar a sua equipa."); return; }
        document.getElementById('form-novo-professor').reset();
        modalNovoProfessor.style.display = 'flex';
    });
    document.getElementById('fechar-modal-professor')?.addEventListener('click', () => modalNovoProfessor.style.display = 'none');

    document.getElementById('form-novo-professor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.querySelector('#form-novo-professor button');
        btnSubmit.textContent = "A salvar..."; btnSubmit.disabled = true;
        try {
            const emailProf = document.getElementById('prof-email').value.trim().toLowerCase();
            await addDoc(collection(db, "academias", academiaAtualId, "professores"), { email: emailProf, dataVinculo: serverTimestamp(), status: "Pendente" });
            await updateDoc(doc(db, "academias", academiaAtualId), { licencasUsadas: increment(1) });
            academiaAtualLicencasUsadas++;
            document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style="color:white;">${academiaAtualLicencasTotais}</strong> em uso`;
            modalNovoProfessor.style.display = 'none';
            carregarProfessoresDaAcademia(); 
            if (userRole === 'super_admin') carregarAcademias(); 
        } catch (e) { console.error(e); alert("Erro ao adicionar."); } finally { btnSubmit.textContent = "Conceder Licença"; btnSubmit.disabled = false; }
    });

    // Fecha o modal se clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === modalNovaAcademia) modalNovaAcademia.style.display = 'none';
        if (e.target === modalNovoProfessor) modalNovoProfessor.style.display = 'none';
    });
}

export async function carregarAcademias() {
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
                <td><span style="color: #00e676;">${acad.licencasUsadas || 0}</span> / ${acad.licencasTotais || 0}</td>
                <td>
                    <button class="action-btn btn-view" title="Ver Detalhes"><span class="material-symbols-outlined" style="font-size: 18px;">visibility</span></button>
                    <button class="action-btn btn-delete" style="color: #ff5252;" title="Excluir"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </td>
            `;
            
            tr.querySelector('.btn-view').addEventListener('click', () => abrirDetalhesAcademia(acad, id));
            tr.querySelector('.btn-delete').addEventListener('click', () => {
                if(confirmarExclusaoGlob) confirmarExclusaoGlob(`Tem a certeza que deseja excluir a academia <strong>"${acad.nome}"</strong>?`, async () => { await deleteDoc(doc(db, "academias", id)); carregarAcademias(); });
            });
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

export async function configurarPainelAcademia(emailGestor) {
    document.getElementById('menu-inicio').style.display = 'none';
    document.getElementById('menu-academias').style.display = 'none';
    document.getElementById('menu-professores').style.display = 'none';
    document.getElementById('menu-templates').style.display = 'none';

    const menuMinha = document.getElementById('menu-minha-academia');
    menuMinha.style.display = 'flex'; menuMinha.click(); 

    try {
        const q = query(collection(db, "academias"), where("emailGestor", "==", emailGestor));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docAcademia = snapshot.docs[0];
            abrirDetalhesAcademia(docAcademia.data(), docAcademia.id);
        } else {
            document.querySelectorAll('.view-section').forEach(s => { if(s) s.style.display = 'none'; });
            const sec = document.getElementById('section-detalhes-academia');
            sec.innerHTML = `<div style="padding: 60px; text-align: center;"><span class="material-symbols-outlined" style="font-size: 64px; color: #ff5252; margin-bottom: 16px;">error</span><h2 style="color: #fff;">Academia Não Encontrada</h2></div>`;
            sec.style.display = 'block';
        }
    } catch (e) { console.error(e); }
}

function abrirDetalhesAcademia(acad, id) {
    document.getElementById('btn-voltar-academias').style.display = (userRole === 'super_admin') ? 'inline-flex' : 'none';

    academiaAtualId = id; 
    academiaAtualDados = acad;
    academiaAtualLicencasTotais = acad.licencasTotais || 0; 
    academiaAtualLicencasUsadas = acad.licencasUsadas || 0;
    
    document.getElementById('detalhe-nome-titulo').textContent = acad.nome;
    document.getElementById('detalhe-cnpj').textContent = acad.cnpj || '--';
    document.getElementById('detalhe-email').textContent = acad.emailGestor || '--';
    document.getElementById('detalhe-telefone').textContent = acad.telefoneResponsavel || '--';
    document.getElementById('detalhe-cep').textContent = acad.cep || '--';
    document.getElementById('detalhe-endereco').textContent = `${acad.endereco || ''} - ${acad.bairro || ''}, ${acad.uf || ''}`;
    document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style="color:white;">${academiaAtualLicencasTotais}</strong> em uso`;
    if (acad.dataCadastro) document.getElementById('detalhe-data').textContent = acad.dataCadastro.toDate().toLocaleDateString('pt-BR');

    document.querySelectorAll('.view-section').forEach(section => { if(section) section.style.display = 'none'; });
    document.getElementById('section-detalhes-academia').style.display = 'block';
    document.getElementById('page-title').textContent = "Minha Academia";
    
    document.querySelectorAll('.nav-links li').forEach(item => item.classList.remove('active')); 
    carregarProfessoresDaAcademia(); 
}

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
            tr.innerHTML = `<td><strong>${prof.email}</strong></td><td><span style="color: ${statusColor}; border: 1px solid ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${prof.status}</span></td><td><button class="action-btn btn-delete-prof" style="color: #ff5252;" title="Remover Licença"><span class="material-symbols-outlined" style="font-size: 18px;">person_remove</span></button></td>`;
            tr.querySelector('.btn-delete-prof').addEventListener('click', async () => {
                if(confirmarExclusaoGlob) confirmarExclusaoGlob(`Remover o acesso Premium de <strong>${prof.email}</strong>?`, async () => {
                    await deleteDoc(doc(db, "academias", academiaAtualId, "professores", profId));
                    await updateDoc(doc(db, "academias", academiaAtualId), { licencasUsadas: increment(-1) });
                    academiaAtualLicencasUsadas--;
                    document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style="color:white;">${academiaAtualLicencasTotais}</strong> em uso`;
                    carregarProfessoresDaAcademia(); if (userRole === 'super_admin') carregarAcademias();
                });
            });
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// =========================================================================
// SISTEMA DE CÁLCULO PRO-RATA (ABA DE PLANOS - MERCADO PAGO)
// =========================================================================

const VALOR_MENSAL_LICENCA = 45.00;
const VALOR_DIARIO_LICENCA = VALOR_MENSAL_LICENCA / 30;

// Elementos da Aba de Planos
const inputQtd = document.getElementById('qtd-licencas-compra');
const selectVencimento = document.getElementById('dia-vencimento-compra');
const btnPagamento = document.getElementById('btn-ir-pagamento');

// Aguarda uma micro fração de tempo para garantir que o HTML carregou os elementos e inicia os listeners
setTimeout(() => {
    if (inputQtd && selectVencimento) {
        calcularProRata(); // Calcula o valor inicial
        inputQtd.addEventListener('input', calcularProRata);
        selectVencimento.addEventListener('change', calcularProRata);
    }
}, 500);

function calcularProRata() {
    if (!inputQtd || !selectVencimento) return;

    const qtd = parseInt(inputQtd.value) || 1;
    const diaVencimentoEscolhido = parseInt(selectVencimento.value);
    
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    
    let diasRestantes = 0;
    let mesProximaCobranca = hoje.getMonth(); 

    // Lógica do Calendário de Cobrança
    if (diaHoje < diaVencimentoEscolhido) {
        diasRestantes = diaVencimentoEscolhido - diaHoje;
    } else if (diaHoje === diaVencimentoEscolhido) {
        diasRestantes = 30; 
        mesProximaCobranca++; 
    } else {
        const diasAteFimDoMes = 30 - diaHoje; // Assumindo mês comercial
        diasRestantes = diasAteFimDoMes + diaVencimentoEscolhido;
        mesProximaCobranca++; 
    }

    // Matemática Financeira
    const valorProporcionalUnidade = diasRestantes * VALOR_DIARIO_LICENCA;
    const valorHojeTotal = valorProporcionalUnidade * qtd;
    const valorRecorrenteTotal = VALOR_MENSAL_LICENCA * qtd;

    const dataProxima = new Date(hoje.getFullYear(), mesProximaCobranca, diaVencimentoEscolhido);
    const dataFormatada = dataProxima.toLocaleDateString('pt-BR');

    // Atualiza o Visual da Aba
    document.getElementById('dias-pro-rata').textContent = diasRestantes;
    document.getElementById('valor-hoje').textContent = valorHojeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('valor-recorrente').textContent = valorRecorrenteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('data-proxima-cobranca').textContent = dataFormatada;
}

// Botão de Pagamento da Aba
btnPagamento?.addEventListener('click', async () => {
    btnPagamento.textContent = "Gerando link seguro...";
    btnPagamento.disabled = true;

    const qtd = parseInt(inputQtd.value) || 1;
    const vencimento = parseInt(selectVencimento.value);
    
    try {
        // 1. A URL real do seu robô no Firebase (Cloud Function):
        const cloudFunctionURL = "https://gerarcheckoutlicencas-pxytyhhu5q-uc.a.run.app";

        // 2. Fazemos o POST (envio de dados) para o nosso Servidor
        const resposta = await fetch(cloudFunctionURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                quantidade: qtd,
                diaVencimento: vencimento,
                emailGestor: currentUserEmail // Enviamos o e-mail logado para o recibo do MP
            })
        });

        const dados = await resposta.json();

        if (resposta.ok && dados.linkPagamento) {
            // 3. Sucesso! Redirecionamos o gestor para a tela de checkout do Mercado Pago
            window.location.href = dados.linkPagamento;
        } else {
            alert("Erro ao gerar pagamento: " + (dados.error || "Desconhecido"));
            btnPagamento.textContent = "Pagar com Mercado Pago 🔒";
            btnPagamento.disabled = false;
        }

    } catch (error) {
        console.error("Erro de conexão:", error);
        alert("Falha ao contactar o servidor de pagamentos.");
        btnPagamento.textContent = "Pagar com Mercado Pago 🔒";
        btnPagamento.disabled = false;
    }
});