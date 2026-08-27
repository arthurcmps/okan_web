import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { showToast } from "./toast.js";
import {
    grantAcademyLicense,
    revokeAcademyLicense
} from "../services/academy-license-service.js";
import {
    getAcademySubscriptionQuote,
    startAcademySubscription
} from "../services/academy-subscription-service.js";
import {
    USER_ROLES
} from "../models/user-model.mjs";

let userRole = null;
let currentUserEmail = null;
let confirmarExclusaoGlob = null;

let modoEdicaoAcademia = false;
let idAcademiaEditando = null;
let academiaAtualId = null; 
let academiaAtualLicencasTotais = 0;
let academiaAtualLicencasUsadas = 0;
let academiaAtualDados = null; 

export function initAcademiasContext(role, email, fnExclusao) {
    userRole = role;
    currentUserEmail = email;
    confirmarExclusaoGlob = fnExclusao;
}

export function setupAcademiasUI() {
    document.getElementById('acad-cnpj')?.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g,""); if (v.length > 14) v = v.substring(0, 14); v = v.replace(/^(\d{2})(\d)/,"$1.$2"); v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3"); v = v.replace(/\.(\d{3})(\d)/,".$1/$2"); v = v.replace(/(\d{4})(\d)/,"$1-$2"); e.target.value = v; });
    document.getElementById('acad-telefone')?.addEventListener('input', (e) => { let v = e.target.value.replace(/\D/g,""); if (v.length > 11) v = v.substring(0, 11); v = v.replace(/^(\d{2})(\d)/g,"($1) $2"); v = v.replace(/(\d)(\d{4})$/,"$1-$2"); e.target.value = v; });
    document.getElementById('acad-cep')?.addEventListener('input', async (e) => { let v = e.target.value.replace(/\D/g,""); if (v.length > 8) v = v.substring(0, 8); v = v.replace(/^(\d{5})(\d)/,"$1-$2"); e.target.value = v; if (v.length === 9) { try { const res = await fetch(`https://viacep.com.br/ws/${v.replace('-', '')}/json/`); const data = await res.json(); if (!data.erro) { document.getElementById('acad-endereco').value = data.logradouro + ', '; document.getElementById('acad-bairro').value = data.bairro; document.getElementById('acad-uf').value = data.uf; document.getElementById('acad-endereco').focus(); } } catch (e) { console.error(e); } } });

    const modalNovaAcademia = document.getElementById('modal-nova-academia');
    const formNovaAcademia = document.getElementById('form-nova-academia');

    document.getElementById('btn-nova-academia')?.addEventListener('click', () => {
        modoEdicaoAcademia = false; idAcademiaEditando = null;
        document.getElementById('titulo-modal-academia').textContent = 'Cadastrar Academia';
        document.getElementById('btn-salvar-academia').textContent = 'Salvar Academia';
        
        const licInput = document.getElementById('acad-licencas');
        if(licInput) {
            licInput.disabled = false;
        }
        formNovaAcademia.reset();
        
        // Garante que o email do gestor esteja habilitado na criação
        document.getElementById('acad-email').disabled = false;
        document.getElementById('acad-email').style.opacity = '1';
        
        modalNovaAcademia.style.display = 'flex';
    });

    // NOVO: Evento para abrir a modal em MODO EDIÇÃO
    document.getElementById('btn-editar-academia')?.addEventListener('click', () => {
        if (!academiaAtualDados) return;

        modoEdicaoAcademia = true; 
        idAcademiaEditando = academiaAtualId;
        
        // Altera os textos da modal
        document.getElementById('titulo-modal-academia').textContent = 'Editar Dados da Academia';
        document.getElementById('btn-salvar-academia').textContent = 'Atualizar Dados';
        
        // Preenche o formulário com os dados atuais
        document.getElementById('acad-nome').value = academiaAtualDados.nome || '';
        document.getElementById('acad-cnpj').value = academiaAtualDados.cnpj || '';
        document.getElementById('acad-cep').value = academiaAtualDados.cep || '';
        document.getElementById('acad-endereco').value = academiaAtualDados.endereco || '';
        document.getElementById('acad-bairro').value = academiaAtualDados.bairro || '';
        document.getElementById('acad-uf').value = academiaAtualDados.uf || '';
        document.getElementById('acad-email').value = academiaAtualDados.emailGestor || '';
        document.getElementById('acad-telefone').value = academiaAtualDados.telefoneResponsavel || '';
        
        // Trava a edição do e-mail do gestor para evitar perda de acesso
        document.getElementById('acad-email').disabled = true;
        document.getElementById('acad-email').style.opacity = '0.5';

        // Lida com o campo de licenças (O gestor não pode editar as próprias licenças)
        const licInput = document.getElementById('acad-licencas');
        if(licInput) {
            licInput.value = academiaAtualDados.licencasTotais || 0;
            if (userRole === USER_ROLES.gymAdmin) {
                licInput.disabled = true;
                licInput.style.opacity = '0.5';
            } else {
                licInput.disabled = false;
                licInput.style.opacity = '1';
            }
        }
        
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
                if (userRole === USER_ROLES.gymAdmin) configurarPainelAcademia(currentUserEmail);
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
        } catch (error) { 
            console.error(error); 
            showToast("Erro ao salvar.", "error");
        } finally { btnSubmit.textContent = "Salvar Dados"; btnSubmit.disabled = false; }
    });

    const modalNovoProfessor = document.getElementById('modal-novo-professor');
    document.getElementById('btn-adicionar-professor')?.addEventListener('click', () => {
        if (academiaAtualLicencasUsadas >= academiaAtualLicencasTotais) { 
            showToast("Limite de licenças atingido! Compre mais no separador de Assinatura.", "error"); 
            return; 
        }
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
            const result = await grantAcademyLicense({
                academyId: academiaAtualId,
                professorEmail: emailProf
            });

            academiaAtualLicencasUsadas = result.licensesUsed;
            academiaAtualLicencasTotais = result.licensesTotal;
            document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style="color:white;">${academiaAtualLicencasTotais}</strong> em uso`;
            modalNovoProfessor.style.display = 'none';

            showToast(
                result.alreadyGranted
                    ? "Este professor já possui uma licença nesta academia."
                    : "Licença concedida com sucesso!",
                "success"
            );

            carregarProfessoresDaAcademia(); 
            if (userRole === USER_ROLES.superAdmin) carregarAcademias();
        } catch (e) { 
            console.error(e); 
            showToast("Não foi possível conceder a licença.", "error"); 
        } finally { btnSubmit.textContent = "Conceder Licença"; btnSubmit.disabled = false; }
    });

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
    const menusGlobais = ['menu-inicio', 'menu-academias', 'menu-professores', 'menu-templates', 'menu-feedbacks'];
    menusGlobais.forEach(id => {
        const menu = document.getElementById(id);
        if (menu) menu.style.display = 'none';
    });

    const menuMinha = document.getElementById('menu-minha-academia');
    const menuPlanos = document.getElementById('menu-planos');
    
    if (menuMinha) menuMinha.style.display = 'flex';
    if (menuPlanos) menuPlanos.style.display = 'flex'; 

    if (menuMinha) menuMinha.click(); 

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
    document.getElementById('btn-voltar-academias').style.display = (userRole === USER_ROLES.superAdmin) ? 'inline-flex' : 'none';

    academiaAtualId = id; 
    academiaAtualDados = acad;
    academiaAtualLicencasTotais = acad.licencasTotais || 0; 
    academiaAtualLicencasUsadas = acad.licencasUsadas || 0;
    
    document.getElementById('detalhe-nome-titulo').textContent = acad.nome;
    document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style="color:white;">${academiaAtualLicencasTotais}</strong> em uso`;
    
    document.getElementById('detalhe-cnpj').textContent = acad.cnpj || '--';
    document.getElementById('detalhe-email').textContent = acad.emailGestor || '--';
    document.getElementById('detalhe-telefone').textContent = acad.telefoneResponsavel || '--';
    document.getElementById('detalhe-cep').textContent = acad.cep || '--';
    
    const enderecoFormatado = acad.endereco ? `${acad.endereco} - ${acad.bairro || ''}, ${acad.uf || ''}` : '--';
    document.getElementById('detalhe-endereco').textContent = enderecoFormatado;

    if (acad.dataCadastro) {
        document.getElementById('detalhe-data').textContent = acad.dataCadastro.toDate().toLocaleDateString('pt-BR');
    } else {
        document.getElementById('detalhe-data').textContent = '--';
    }
    
    const statusAssinatura = acad.statusAssinatura ||
        (academiaAtualLicencasTotais > 0 ? 'Ativa' : 'Aguardando Pagamento');
    const cancelamentoAgendado = acad.cancelamentoAgendado || false;
    
    const painelAtiva = document.getElementById('painel-assinatura-ativa');
    const painelCompra = document.getElementById('painel-comprar-licencas');

    if (statusAssinatura === 'Ativa' || statusAssinatura === 'Pendente') {
        painelAtiva.style.display = 'block';
        painelCompra.style.display = 'none';

        document.getElementById('ass-licencas').textContent = academiaAtualLicencasTotais;
        document.getElementById('ass-vencimento').textContent = `Todo dia ${acad.diaVencimento || '--'}`;
        document.getElementById('ass-valor').textContent = `R$ ${(academiaAtualLicencasTotais * 45).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        const badgeStatus = document.getElementById('ass-status');
        const msgCancelamento = document.getElementById('msg-cancelamento');
        const btnCancelar = document.getElementById('btn-cancelar-assinatura');

        if (cancelamentoAgendado) {
            badgeStatus.textContent = "Cancelamento Agendado";
            badgeStatus.style.color = "#ff5252";
            badgeStatus.style.borderColor = "#ff5252";
            badgeStatus.style.background = "rgba(255, 82, 82, 0.1)";
            
            if (msgCancelamento) msgCancelamento.style.display = 'block';
            if (btnCancelar) btnCancelar.style.display = 'none';
        } else {
            badgeStatus.textContent = "Assinatura Ativa";
            badgeStatus.style.color = "#00e676";
            badgeStatus.style.borderColor = "#00e676";
            badgeStatus.style.background = "rgba(0, 230, 118, 0.1)";
            
            if (msgCancelamento) msgCancelamento.style.display = 'none';
            if (btnCancelar) btnCancelar.style.display = 'block';
        }
    } else {
        painelAtiva.style.display = 'none';
        painelCompra.style.display = 'block';
    }

    document.querySelectorAll('.view-section').forEach(section => { if(section) section.style.display = 'none'; });
    document.getElementById('section-detalhes-academia').style.display = 'block';
    carregarProfessoresDaAcademia(); 
}

document.getElementById('btn-cancelar-assinatura')?.addEventListener('click', () => {
    if (confirmarExclusaoGlob) {
        confirmarExclusaoGlob(
            `Tem a certeza que deseja cancelar a sua assinatura? <br><br> 
            <small style="color: #aaa;">Os seus professores continuarão com acesso Premium até ao próximo dia de vencimento, mas não haverá novas cobranças.</small>`, 
            async () => {
                try {
                    await updateDoc(doc(db, "academias", academiaAtualId), { 
                        cancelamentoAgendado: true 
                    });
                    showToast("Cancelamento agendado com sucesso!", "success");
                    setTimeout(() => {
                        window.location.reload(); 
                    }, 2000);
                } catch (e) {
                    console.error("Erro ao cancelar:", e);
                    showToast("Erro ao processar o pedido de cancelamento.", "error");
                }
            }
        );
    }
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
            tr.innerHTML = `<td><strong>${prof.email}</strong></td><td><span style="color: ${statusColor}; border: 1px solid ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${prof.status}</span></td><td><button class="action-btn btn-delete-prof" style="color: #ff5252;" title="Remover Licença"><span class="material-symbols-outlined" style="font-size: 18px;">person_remove</span></button></td>`;
            tr.querySelector('.btn-delete-prof').addEventListener('click', async () => {
                if(confirmarExclusaoGlob) confirmarExclusaoGlob(`Remover o acesso Premium de <strong>${prof.email}</strong>?`, async () => {
                    try {
                        const result = await revokeAcademyLicense({
                            academyId: academiaAtualId,
                            licenseId: profId
                        });

                        academiaAtualLicencasUsadas = result.licensesUsed;
                        academiaAtualLicencasTotais = result.licensesTotal;
                        document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style="color:white;">${academiaAtualLicencasTotais}</strong> em uso`;

                        showToast(
                            result.alreadyRemoved
                                ? "A licença já havia sido removida."
                                : "Licença removida com sucesso!",
                            "success"
                        );

                        carregarProfessoresDaAcademia();
                        if (userRole === USER_ROLES.superAdmin) carregarAcademias();
                    } catch (e) {
                        console.error(e);
                        showToast("Não foi possível remover a licença.", "error");
                    }
                });
            });
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

const inputQtd = document.getElementById('qtd-licencas-compra');
const selectVencimento = document.getElementById('dia-vencimento-compra');
const btnPagamento = document.getElementById('btn-ir-pagamento');

let ultimaCotacaoAssinatura = null;
let idTentativaAssinatura = null;
let sequenciaCotacao = 0;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function prepararResumoAssinatura() {
    const diasProRata = document.getElementById('dias-pro-rata');
    const dataProxima = document.getElementById('data-proxima-cobranca');

    if (diasProRata?.parentElement) {
        diasProRata.parentElement.textContent =
            'Valor mensal calculado com segurança pelo servidor:';
    }

    if (dataProxima?.parentElement) {
        dataProxima.parentElement.textContent =
            'O Mercado Pago calcula eventual valor proporcional conforme o dia de vencimento escolhido.';
    }
}

async function atualizarCotacaoAssinatura() {
    if (!inputQtd || !selectVencimento) return null;

    const licenseQuantity = parseInt(inputQtd.value) || 1;
    const billingDay = parseInt(selectVencimento.value);
    const requestSequence = ++sequenciaCotacao;

    try {
        const quote = await getAcademySubscriptionQuote({
            licenseQuantity,
            billingDay
        });

        if (requestSequence !== sequenciaCotacao) {
            return ultimaCotacaoAssinatura;
        }

        ultimaCotacaoAssinatura = quote;
        idTentativaAssinatura = null;

        const valorHoje = document.getElementById('valor-hoje');
        if (valorHoje) {
            valorHoje.textContent = formatarMoeda(quote.monthlyAmount);
        }

        return quote;
    } catch (error) {
        if (requestSequence === sequenciaCotacao) {
            ultimaCotacaoAssinatura = null;
        }

        console.error(
            'Erro ao obter cotação da assinatura:',
            error?.code || error?.message || error
        );

        return null;
    }
}

setTimeout(() => {
    prepararResumoAssinatura();

    if (inputQtd && selectVencimento) {
        atualizarCotacaoAssinatura();
        inputQtd.addEventListener('change', atualizarCotacaoAssinatura);
        selectVencimento.addEventListener('change', atualizarCotacaoAssinatura);
    }
}, 500);

const mp = new MercadoPago(
    'APP_USR-a228ff68-eeb9-41ba-9432-830451583ffb',
    { locale: 'pt-BR' }
);
const bricksBuilder = mp.bricks();
window.paymentBrickController = null;

btnPagamento?.addEventListener('click', async () => {
    const quote = await atualizarCotacaoAssinatura();

    if (!quote) {
        showToast(
            'Não foi possível calcular a assinatura. Atualize a página e tente novamente.',
            'error'
        );
        return;
    }

    btnPagamento.style.display = 'none';
    inputQtd.disabled = true;
    selectVencimento.disabled = true;

    idTentativaAssinatura = crypto.randomUUID();

    if (window.paymentBrickController) {
        await window.paymentBrickController.unmount();
        window.paymentBrickController = null;
    }

    const settings = {
        initialization: {
            amount: quote.monthlyAmount
        },
        customization: {
            paymentMethods: {
                creditCard: "all"
            },
            visual: {
                style: {
                    theme: 'dark'
                }
            }
        },
        callbacks: {
            onReady: () => {
                console.log('Formulário de pagamento pronto.');
            },
            onSubmit: async ({ formData }) => {
                try {
                    const cardTokenId = String(formData?.token || '').trim();

                    if (!cardTokenId) {
                        throw new Error('CARD_TOKEN_REQUIRED');
                    }

                    const result = await startAcademySubscription({
                        licenseQuantity: quote.licenseQuantity,
                        billingDay: quote.billingDay,
                        attemptId: idTentativaAssinatura,
                        cardTokenId
                    });

                    showToast(
                        result.providerStatus === 'authorized'
                            ? 'Assinatura criada. Aguardando a confirmação da cobrança para liberar as licenças.'
                            : 'Assinatura enviada ao Mercado Pago. Aguardando confirmação.',
                        'success'
                    );

                    setTimeout(() => {
                        window.location.reload();
                    }, 3500);
                } catch (error) {
                    console.error(
                        'Erro ao iniciar assinatura:',
                        error?.code || error?.message || error
                    );

                    const mensagem =
                        error?.code === 'functions/failed-precondition'
                            ? error.message
                            : error?.code === 'functions/already-exists'
                                ? 'Esta academia já possui uma assinatura ativa ou em processamento.'
                                : error?.code === 'functions/unavailable'
                                    ? 'O Mercado Pago está temporariamente indisponível.'
                                    : 'Não foi possível concluir a assinatura.';

                    showToast(mensagem, 'error');
                    throw error;
                }
            },
            onError: (error) => {
                console.error(
                    'Erro no formulário de pagamento:',
                    error?.type || error?.message || error
                );
            },
        },
    };

    try {
        window.paymentBrickController = await bricksBuilder.create(
            'payment',
            'paymentBrick_container',
            settings
        );
    } catch (error) {
        console.error(
            'Erro ao renderizar pagamento:',
            error?.message || error
        );
        showToast('Não foi possível abrir o formulário de pagamento.', 'error');
        btnPagamento.style.display = 'block';
        inputQtd.disabled = false;
        selectVencimento.disabled = false;
    }
});