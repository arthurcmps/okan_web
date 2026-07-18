// script/modules/loja.js
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";

let idTemplateEditando = null;
let exerciciosDoTemplateAtual = []; 

// Variáveis de controlo de Edição
let idExercicioCatalogoEditando = null;    // Controla a edição no banco de dados global
let indexExercicioTemplateEditando = null; // Controla a edição do exercício que já está na ficha

const tagsDisponiveis = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Iniciante', 'Intermediário', 'Avançado', 'Casa', 'Academia', 'Sem Impacto'];

let confirmarExclusaoGlobal = null; 

export function initLoja(funcaoConfirmarExclusao) {
    confirmarExclusaoGlobal = funcaoConfirmarExclusao;

    // 1. Gera as tags visuais
    const tagsContainer = document.getElementById('tpl-tags-container');
    if (tagsContainer) {
        tagsDisponiveis.forEach(tag => {
            const label = document.createElement('label');
            label.className = 'tag-chip';
            label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
            label.addEventListener('change', (e) => { e.target.checked ? label.classList.add('selected') : label.classList.remove('selected'); });
            tagsContainer.appendChild(label);
        });
    }

    // 2. Modais e Botões principais do Template
    const modalTemplate = document.getElementById('modal-template-builder');
    document.getElementById('btn-novo-template')?.addEventListener('click', () => {
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

    document.getElementById('fechar-modal-template')?.addEventListener('click', () => modalTemplate.style.display = 'none');

    document.getElementById('btn-salvar-template')?.addEventListener('click', async () => {
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
                await updateDoc(doc(db, "workout_templates", idTemplateEditando), dataMap);
            } else {
                dataMap.timestamp = serverTimestamp();
                await addDoc(collection(db, "workout_templates"), dataMap);
            }
            modalTemplate.style.display = 'none';
            carregarTemplatesLoja();
        } catch (error) { console.error(error); alert("Erro ao salvar o template."); } 
        finally { btnSalvar.textContent = "Salvar na Loja"; btnSalvar.disabled = false; }
    });

    // 3. Catálogo de Exercícios (Abertura e Renderização)
    const modalCatalogo = document.getElementById('modal-catalogo');
    let exercicioSelecionadoTemporario = null;

    document.getElementById('btn-abrir-catalogo')?.addEventListener('click', async () => {
        modalCatalogo.style.display = 'flex';
        const lista = document.getElementById('lista-catalogo');
        lista.innerHTML = '<p style="color: #aaa; text-align: center;">A buscar...</p>';
        try {
            const snapshot = await getDocs(collection(db, "exercises"));
            lista.innerHTML = '';
            if (snapshot.empty) { lista.innerHTML = '<p style="color: #aaa; text-align: center;">Nenhum exercício no banco de dados.</p>'; return; }
            
            snapshot.forEach(docSnap => {
                const ex = docSnap.data();
                const exId = docSnap.id; // Precisamos do ID para edição no banco
                
                const div = document.createElement('div');
                div.style.padding = '12px'; 
                div.style.borderBottom = '1px solid #333'; 
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';
                
                // Área clicável para ADICIONAR à ficha
                const infoDiv = document.createElement('div');
                infoDiv.style.cursor = 'pointer';
                infoDiv.style.flex = '1';
                infoDiv.innerHTML = `<strong style="color: white;">${ex.nome}</strong><br><span style="color: #aaa; font-size: 12px;">${ex.grupo || ''}</span>`;
                
                infoDiv.addEventListener('click', () => {
                    indexExercicioTemplateEditando = null; // Como veio do catálogo, é um NOVO exercício para a ficha
                    exercicioSelecionadoTemporario = ex;
                    
                    document.getElementById('nome-exercicio-config').textContent = ex.nome;
                    document.getElementById('config-series').value = "3";
                    document.getElementById('config-reps').value = "10 a 12";
                    
                    const videoInput = document.getElementById('config-video');
                    if (videoInput) videoInput.value = ex.videoUrl || '';

                    modalCatalogo.style.display = 'none';
                    document.getElementById('modal-config-series').style.display = 'flex';
                });

                // Botão de EDITAR no Banco Global
                const btnEditCatalogo = document.createElement('button');
                btnEditCatalogo.className = 'action-btn';
                btnEditCatalogo.innerHTML = '<span class="material-symbols-outlined" style="color: #00e676; font-size: 18px;">edit</span>';
                btnEditCatalogo.title = "Editar Exercício no Banco";
                
                btnEditCatalogo.addEventListener('click', (e) => {
                    e.stopPropagation(); // Evita que o clique acione a adição à ficha
                    
                    idExercicioCatalogoEditando = exId; // Salva o ID para sabermos que é edição
                    
                    // Preenche o formulário de cadastro de exercício
                    document.getElementById('novo-ex-nome').value = ex.nome || '';
                    document.getElementById('novo-ex-grupo').value = ex.grupo || '';
                    document.getElementById('novo-ex-video').value = ex.videoUrl || '';
                    
                    // Ajusta títulos e botões
                    document.querySelector('#modal-novo-exercicio-global h2').textContent = "Editar Exercício (Global)";
                    document.getElementById('btn-salvar-novo-exercicio').textContent = "Atualizar Catálogo";

                    modalCatalogo.style.display = 'none';
                    document.getElementById('modal-novo-exercicio-global').style.display = 'flex';
                });

                div.append(infoDiv, btnEditCatalogo);
                lista.appendChild(div);
            });
        } catch(e) { console.error(e); }
    });

    document.getElementById('fechar-modal-catalogo')?.addEventListener('click', () => modalCatalogo.style.display = 'none');
    document.getElementById('fechar-modal-config-series')?.addEventListener('click', () => {
        document.getElementById('modal-config-series').style.display = 'none';
    });

    // 4. Salvar Configuração de Séries (Adiciona NOVO ou Edita EXISTENTE na ficha)
    document.getElementById('btn-confirmar-exercicio')?.addEventListener('click', () => {
        const videoInput = document.getElementById('config-video');
        const videoValor = videoInput ? videoInput.value.trim() : "";

        if (indexExercicioTemplateEditando !== null) {
            // MODO EDIÇÃO NA FICHA
            exerciciosDoTemplateAtual[indexExercicioTemplateEditando].series = document.getElementById('config-series').value;
            exerciciosDoTemplateAtual[indexExercicioTemplateEditando].repeticoes = document.getElementById('config-reps').value;
            exerciciosDoTemplateAtual[indexExercicioTemplateEditando].videoUrl = videoValor;
        } else {
            // MODO NOVO NA FICHA
            exerciciosDoTemplateAtual.push({
                id: Date.now().toString(),
                nome: exercicioSelecionadoTemporario.nome,
                series: document.getElementById('config-series').value,
                repeticoes: document.getElementById('config-reps').value,
                videoUrl: videoValor
            });
        }

        document.getElementById('modal-config-series').style.display = 'none';
        indexExercicioTemplateEditando = null; // Reseta a variável de controle
        atualizarListaExerciciosUI();
    });

    // 5. Modal de Novo/Edição de Exercício Global
    const modalNovoExercicio = document.getElementById('modal-novo-exercicio-global');
    const formNovoExercicio = document.getElementById('form-novo-exercicio-global');

    document.getElementById('btn-novo-exercicio-global')?.addEventListener('click', () => {
        idExercicioCatalogoEditando = null; // É uma CRIAÇÃO
        formNovoExercicio.reset();
        
        document.querySelector('#modal-novo-exercicio-global h2').textContent = "Novo Exercício";
        document.getElementById('btn-salvar-novo-exercicio').textContent = "Salvar no Catálogo";

        modalCatalogo.style.display = 'none'; 
        modalNovoExercicio.style.display = 'flex';
    });

    document.getElementById('fechar-modal-novo-exercicio')?.addEventListener('click', () => {
        modalNovoExercicio.style.display = 'none';
        modalCatalogo.style.display = 'flex'; // Volta pro catálogo
    });

    // Salvar/Atualizar no Banco Global
    formNovoExercicio?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSalvar = document.getElementById('btn-salvar-novo-exercicio');
        btnSalvar.textContent = "A processar..."; btnSalvar.disabled = true;

        const nome = document.getElementById('novo-ex-nome').value.trim();
        const grupo = document.getElementById('novo-ex-grupo').value.trim();
        const videoUrl = document.getElementById('novo-ex-video').value.trim();

        try {
            if (idExercicioCatalogoEditando) {
                // ATUALIZA NO BANCO
                await updateDoc(doc(db, "exercises", idExercicioCatalogoEditando), {
                    nome: nome, grupo: grupo, videoUrl: videoUrl
                });
            } else {
                // CRIA NO BANCO
                await addDoc(collection(db, "exercises"), {
                    nome: nome, grupo: grupo, videoUrl: videoUrl, criadoEm: serverTimestamp()
                });
            }
            
            modalNovoExercicio.style.display = 'none';
            idExercicioCatalogoEditando = null; // Reseta variável
            document.getElementById('btn-abrir-catalogo').click(); // Reabre e atualiza a lista do catálogo
            
        } catch (error) {
            console.error("Erro ao salvar:", error); alert("Erro ao salvar o exercício.");
        } finally { 
            btnSalvar.textContent = "Salvar no Catálogo"; 
            btnSalvar.disabled = false; 
        }
    });

    // Torna a função global para o HTML (Se necessário em algum momento)
    window.removerExercicioDoTemplate = function(index) {
        exerciciosDoTemplateAtual.splice(index, 1);
        atualizarListaExerciciosUI();
    }

    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === modalTemplate) modalTemplate.style.display = 'none';
        if (e.target === modalCatalogo) modalCatalogo.style.display = 'none';
        if (e.target === modalNovoExercicio) modalNovoExercicio.style.display = 'none';
        if (e.target === document.getElementById('modal-config-series')) document.getElementById('modal-config-series').style.display = 'none';
    });
}

export async function carregarTemplatesLoja() {
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

            tr.querySelector('.btn-edit-tpl').addEventListener('click', () => {
                idTemplateEditando = id;
                // Faz uma cópia profunda da lista para não alterar o banco sem salvar
                exerciciosDoTemplateAtual = JSON.parse(JSON.stringify(tpl.exercicios || [])); 
                
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
                document.getElementById('modal-template-builder').style.display = 'flex';
            });

            tr.querySelector('.btn-delete-tpl').addEventListener('click', () => {
                if(confirmarExclusaoGlobal) {
                    confirmarExclusaoGlobal(
                        `Remover o treino <strong>"${tpl.nome}"</strong> da loja oficial?<br>Os professores que já compraram continuarão a ter acesso.`,
                        async () => {
                            await deleteDoc(doc(db, "workout_templates", id));
                            carregarTemplatesLoja();
                        }
                    );
                }
            });
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

function criarItemExercicio(ex, index) {
    const li = document.createElement('li');
    li.className = 'exercise-item';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'exercise-item-info';

    const nomeStrong = document.createElement('strong');
    nomeStrong.textContent = ex.nome;

    const seriesSpan = document.createElement('span');
    seriesSpan.textContent = `${ex.series}x ${ex.repeticoes}`;

    infoDiv.append(nomeStrong, seriesSpan);

    // Div para agrupar os botões de ação (Editar e Remover)
    const botoesDiv = document.createElement('div');
    botoesDiv.style.display = 'flex';
    botoesDiv.style.gap = '12px';
    botoesDiv.style.alignItems = 'center';

    // Botão de Editar na Ficha
    const btnEditar = document.createElement('button');
    btnEditar.className = 'action-btn';
    btnEditar.style.color = '#fff';
    btnEditar.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">edit</span>';
    
    btnEditar.addEventListener('click', () => {
        indexExercicioTemplateEditando = index; // Guardamos qual posição da lista estamos a editar
        
        document.getElementById('nome-exercicio-config').textContent = ex.nome;
        document.getElementById('config-series').value = ex.series || '';
        document.getElementById('config-reps').value = ex.repeticoes || '';
        
        const videoInput = document.getElementById('config-video');
        if(videoInput) videoInput.value = ex.videoUrl || '';

        document.getElementById('modal-config-series').style.display = 'flex';
    });

    // Botão de Remover da Ficha
    const btnRemover = document.createElement('button');
    btnRemover.className = 'action-btn';
    btnRemover.style.color = '#ff5252';
    btnRemover.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">close</span>';

    btnRemover.addEventListener('click', () => {
        removerExercicioDoTemplate(index);
    });

    botoesDiv.append(btnEditar, btnRemover);
    li.append(infoDiv, botoesDiv);
    return li;
}

function atualizarListaExerciciosUI() {
    const ul = document.getElementById('lista-exercicios-template');
    if(!ul) return;
    
    while (ul.firstChild) {
        ul.removeChild(ul.firstChild);
    }

    exerciciosDoTemplateAtual.forEach((ex, index) => {
        const liComponent = criarItemExercicio(ex, index);
        ul.appendChild(liComponent);
    });
}