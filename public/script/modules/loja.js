// script/modules/loja.js
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase.js";

let idTemplateEditando = null;

// --- NOVA LÓGICA DE SÉRIES MÚLTIPLAS ---
let seriesDoTemplateAtual = { 'A': [], 'B': [], 'C': [], 'D': [], 'E': [] };
let serieAtiva = 'A'; // Aba que está aberta no momento

let idExercicioCatalogoEditando = null;    
let indexExercicioTemplateEditando = null; 
let todosExerciciosCatalogo = []; 

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

    // 1.5 Controle das Abas (Fichas A, B, C...)
    document.querySelectorAll('#seletor-series .tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            // Tira a seleção de todos
            document.querySelectorAll('#seletor-series .tag-chip').forEach(c => {
                c.classList.remove('selected');
                c.style.borderColor = '#444'; 
            });
            // Seleciona o clicado
            chip.classList.add('selected');
            chip.style.borderColor = '#ff5252';
            
            // Muda a série ativa e atualiza a UI
            serieAtiva = chip.getAttribute('data-serie');
            atualizarListaExerciciosUI();
        });
    });

    // 2. Modais e Botões principais do Template
    const modalTemplate = document.getElementById('modal-template-builder');
    document.getElementById('btn-novo-template')?.addEventListener('click', () => {
        idTemplateEditando = null;
        
        // Zera o dicionário de séries
        seriesDoTemplateAtual = { 'A': [], 'B': [], 'C': [], 'D': [], 'E': [] };
        
        // Volta a aba visual para "A"
        document.querySelector('#seletor-series .tag-chip[data-serie="A"]').click();
        
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
        const preco = parseFloat(document.getElementById('tpl-preco').value) || 0.0;
        const tagsSelecionadas = Array.from(document.querySelectorAll('.tag-chip input:checked')).map(cb => cb.value);

        // Filtra para salvar apenas as fichas que têm exercícios dentro
        const fichasParaSalvar = {};
        for (const [letra, lista] of Object.entries(seriesDoTemplateAtual)) {
            if (lista.length > 0) {
                fichasParaSalvar[letra] = lista;
            }
        }

        if(!nome || Object.keys(fichasParaSalvar).length === 0) { 
            alert("Preencha o nome e adicione pelo menos 1 exercício em alguma das Fichas."); 
            return; 
        }

        const dataMap = {
            personalId: 'SYSTEM_ADMIN', 
            nome: nome,
            preco: preco,
            tags: tagsSelecionadas,
            fichas: fichasParaSalvar, // <--- NOVO FORMATO ESTRUTURADO
            isPremium: true
        };

        const btnSalvar = document.getElementById('btn-salvar-template');
        btnSalvar.textContent = "A salvar..."; btnSalvar.disabled = true;

        try {
            if (idTemplateEditando) {
                // Ao atualizar, o Firebase vai substituir o campo de fichas
                await updateDoc(doc(db, "workout_templates", idTemplateEditando), {
                    ...dataMap,
                    exercicios: null // Remove o array legado, se existir
                });
            } else {
                dataMap.timestamp = serverTimestamp();
                await addDoc(collection(db, "workout_templates"), dataMap);
            }
            modalTemplate.style.display = 'none';
            carregarTemplatesLoja();
        } catch (error) { console.error(error); alert("Erro ao salvar o template."); } 
        finally { btnSalvar.textContent = "Salvar na Loja"; btnSalvar.disabled = false; }
    });

    // 3. Catálogo de Exercícios com Filtros
    const modalCatalogo = document.getElementById('modal-catalogo');
    let exercicioSelecionadoTemporario = null;

    function renderizarCatalogoFiltrado() {
        const termoBusca = (document.getElementById('filtro-nome-exercicio')?.value || '').toLowerCase().trim();
        const grupoBusca = (document.getElementById('filtro-grupo-exercicio')?.value || '').toLowerCase();
        const lista = document.getElementById('lista-catalogo');
        
        lista.innerHTML = '';

        const exerciciosFiltrados = todosExerciciosCatalogo.filter(ex => {
            const nomeStr = (ex.nome || '').toLowerCase();
            const grupoStr = (ex.grupo || '').toLowerCase();
            const matchNome = nomeStr.includes(termoBusca);
            const matchGrupo = grupoBusca === '' || grupoStr.includes(grupoBusca);
            return matchNome && matchGrupo;
        });

        if (exerciciosFiltrados.length === 0) {
            lista.innerHTML = '<p style="color: #aaa; text-align: center; padding: 16px;">Nenhum exercício encontrado.</p>';
            return;
        }

        exerciciosFiltrados.forEach(ex => {
            const div = document.createElement('div');
            div.style.padding = '12px'; 
            div.style.borderBottom = '1px solid #333'; 
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            
            const infoDiv = document.createElement('div');
            infoDiv.style.cursor = 'pointer';
            infoDiv.style.flex = '1';
            infoDiv.innerHTML = `<strong style="color: white;">${ex.nome}</strong><br><span style="color: #aaa; font-size: 12px;">${ex.grupo || 'Sem grupo'}</span>`;
            
            infoDiv.addEventListener('click', () => {
                indexExercicioTemplateEditando = null; 
                exercicioSelecionadoTemporario = ex;
                
                document.getElementById('nome-exercicio-config').textContent = ex.nome;
                document.getElementById('config-series').value = "3";
                document.getElementById('config-reps').value = "10 a 12";
                
                const videoInput = document.getElementById('config-video');
                if (videoInput) videoInput.value = ex.videoUrl || '';

                modalCatalogo.style.display = 'none';
                document.getElementById('modal-config-series').style.display = 'flex';
            });

            const btnEditCatalogo = document.createElement('button');
            btnEditCatalogo.className = 'action-btn';
            btnEditCatalogo.innerHTML = '<span class="material-symbols-outlined" style="color: #00e676; font-size: 18px;">edit</span>';
            btnEditCatalogo.title = "Editar Exercício no Banco";
            
            btnEditCatalogo.addEventListener('click', (e) => {
                e.stopPropagation(); 
                idExercicioCatalogoEditando = ex.id; 
                
                document.getElementById('novo-ex-nome').value = ex.nome || '';
                document.getElementById('novo-ex-grupo').value = ex.grupo || '';
                document.getElementById('novo-ex-video').value = ex.videoUrl || '';
                
                document.querySelector('#modal-novo-exercicio-global h2').textContent = "Editar Exercício (Global)";
                document.getElementById('btn-salvar-novo-exercicio').textContent = "Atualizar Catálogo";

                modalCatalogo.style.display = 'none';
                document.getElementById('modal-novo-exercicio-global').style.display = 'flex';
            });

            div.append(infoDiv, btnEditCatalogo);
            lista.appendChild(div);
        });
    }

    document.getElementById('filtro-nome-exercicio')?.addEventListener('input', renderizarCatalogoFiltrado);
    document.getElementById('filtro-grupo-exercicio')?.addEventListener('change', renderizarCatalogoFiltrado);

    document.getElementById('btn-abrir-catalogo')?.addEventListener('click', async () => {
        modalCatalogo.style.display = 'flex';
        const lista = document.getElementById('lista-catalogo');
        
        if(document.getElementById('filtro-nome-exercicio')) document.getElementById('filtro-nome-exercicio').value = '';
        if(document.getElementById('filtro-grupo-exercicio')) document.getElementById('filtro-grupo-exercicio').value = '';

        lista.innerHTML = '<p style="color: #aaa; text-align: center; padding: 16px;">A buscar catálogo...</p>';
        try {
            const snapshot = await getDocs(collection(db, "exercises"));
            todosExerciciosCatalogo = []; 
            
            if (!snapshot.empty) {
                snapshot.forEach(docSnap => {
                    const ex = docSnap.data();
                    ex.id = docSnap.id; 
                    todosExerciciosCatalogo.push(ex);
                });
                todosExerciciosCatalogo.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            }
            renderizarCatalogoFiltrado();
            
        } catch(e) { console.error(e); }
    });

    document.getElementById('fechar-modal-catalogo')?.addEventListener('click', () => modalCatalogo.style.display = 'none');
    document.getElementById('fechar-modal-config-series')?.addEventListener('click', () => {
        document.getElementById('modal-config-series').style.display = 'none';
    });

    // 4. Salvar Configuração de Séries (Guarda dentro da Ficha Ativa)
    document.getElementById('btn-confirmar-exercicio')?.addEventListener('click', () => {
        const videoInput = document.getElementById('config-video');
        const videoValor = videoInput ? videoInput.value.trim() : "";

        if (indexExercicioTemplateEditando !== null) {
            seriesDoTemplateAtual[serieAtiva][indexExercicioTemplateEditando].series = document.getElementById('config-series').value;
            seriesDoTemplateAtual[serieAtiva][indexExercicioTemplateEditando].repeticoes = document.getElementById('config-reps').value;
            seriesDoTemplateAtual[serieAtiva][indexExercicioTemplateEditando].videoUrl = videoValor;
        } else {
            seriesDoTemplateAtual[serieAtiva].push({
                id: Date.now().toString(),
                nome: exercicioSelecionadoTemporario.nome,
                series: document.getElementById('config-series').value,
                repeticoes: document.getElementById('config-reps').value,
                videoUrl: videoValor
            });
        }

        document.getElementById('modal-config-series').style.display = 'none';
        indexExercicioTemplateEditando = null; 
        atualizarListaExerciciosUI();
    });

    // 5. Modal de Novo/Edição de Exercício Global
    const modalNovoExercicio = document.getElementById('modal-novo-exercicio-global');
    const formNovoExercicio = document.getElementById('form-novo-exercicio-global');

    document.getElementById('btn-novo-exercicio-global')?.addEventListener('click', () => {
        idExercicioCatalogoEditando = null; 
        formNovoExercicio.reset();
        
        document.querySelector('#modal-novo-exercicio-global h2').textContent = "Novo Exercício";
        document.getElementById('btn-salvar-novo-exercicio').textContent = "Salvar no Catálogo";

        modalCatalogo.style.display = 'none'; 
        modalNovoExercicio.style.display = 'flex';
    });

    document.getElementById('fechar-modal-novo-exercicio')?.addEventListener('click', () => {
        modalNovoExercicio.style.display = 'none';
        modalCatalogo.style.display = 'flex'; 
    });

    formNovoExercicio?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSalvar = document.getElementById('btn-salvar-novo-exercicio');
        btnSalvar.textContent = "A processar..."; btnSalvar.disabled = true;

        const nome = document.getElementById('novo-ex-nome').value.trim();
        const grupo = document.getElementById('novo-ex-grupo').value.trim();
        const videoUrl = document.getElementById('novo-ex-video').value.trim();

        try {
            if (idExercicioCatalogoEditando) {
                await updateDoc(doc(db, "exercises", idExercicioCatalogoEditando), {
                    nome: nome, grupo: grupo, videoUrl: videoUrl
                });
            } else {
                await addDoc(collection(db, "exercises"), {
                    nome: nome, grupo: grupo, videoUrl: videoUrl, criadoEm: serverTimestamp()
                });
            }
            
            modalNovoExercicio.style.display = 'none';
            idExercicioCatalogoEditando = null; 
            document.getElementById('btn-abrir-catalogo').click(); 
            
        } catch (error) {
            console.error("Erro ao salvar:", error); alert("Erro ao salvar o exercício.");
        } finally { 
            btnSalvar.textContent = "Salvar no Catálogo"; 
            btnSalvar.disabled = false; 
        }
    });

    window.removerExercicioDoTemplate = function(index) {
        seriesDoTemplateAtual[serieAtiva].splice(index, 1);
        atualizarListaExerciciosUI();
    }

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

            // Conta quantas fichas diferentes o template tem
            let qtdFichas = 0;
            if (tpl.fichas) {
                qtdFichas = Object.keys(tpl.fichas).length;
            } else if (tpl.exercicios && tpl.exercicios.length > 0) {
                qtdFichas = 1; // Template legado conta como 1 ficha
            }
            const infoFichas = qtdFichas > 0 ? `<span style="color: #00e676; font-weight:bold;">${qtdFichas} Ficha(s)</span> • ` : '';

            tr.innerHTML = `
                <td style="font-weight: bold;">${tpl.nome}</td>
                <td style="color: #ff5252;">${precoStr}</td>
                <td style="font-size: 12px; color: #aaa;">${infoFichas}${tagsStr}</td>
                <td>
                    <button class="action-btn btn-edit-tpl" title="Editar Produto"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span></button>
                    <button class="action-btn btn-delete-tpl" style="color: #ff5252;" title="Excluir da Loja"><span class="material-symbols-outlined" style="font-size: 18px;">delete</span></button>
                </td>
            `;

            tr.querySelector('.btn-edit-tpl').addEventListener('click', () => {
                idTemplateEditando = id;
                
                // Conversão Inteligente: Lê do formato novo, ou converte o velho
                seriesDoTemplateAtual = { 'A': [], 'B': [], 'C': [], 'D': [], 'E': [] };
                if (tpl.fichas) {
                    for (const key in tpl.fichas) {
                        seriesDoTemplateAtual[key] = JSON.parse(JSON.stringify(tpl.fichas[key]));
                    }
                } else if (tpl.exercicios) {
                    seriesDoTemplateAtual['A'] = JSON.parse(JSON.stringify(tpl.exercicios));
                }

                // Clica na Ficha A para abrir por defeito
                document.querySelector('#seletor-series .tag-chip[data-serie="A"]').click();
                
                document.getElementById('titulo-modal-template').textContent = 'Editar Produto';
                document.getElementById('btn-salvar-template').textContent = 'Atualizar na Loja';
                document.getElementById('tpl-nome').value = tpl.nome || '';
                document.getElementById('tpl-preco').value = tpl.preco ? tpl.preco.toFixed(2) : '0.00';
                
                const tagsDoTpl = tpl.tags || [];
                document.querySelectorAll('.tag-chip input').forEach(input => {
                    if (tagsDoTpl.includes(input.value)) { input.checked = true; input.parentElement.classList.add('selected'); } 
                    else { input.checked = false; input.parentElement.classList.remove('selected'); }
                });

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

    const botoesDiv = document.createElement('div');
    botoesDiv.style.display = 'flex';
    botoesDiv.style.gap = '12px';
    botoesDiv.style.alignItems = 'center';

    const btnEditar = document.createElement('button');
    btnEditar.className = 'action-btn';
    btnEditar.style.color = '#fff';
    btnEditar.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">edit</span>';
    
    btnEditar.addEventListener('click', () => {
        indexExercicioTemplateEditando = index; 
        
        document.getElementById('nome-exercicio-config').textContent = ex.nome;
        document.getElementById('config-series').value = ex.series || '';
        document.getElementById('config-reps').value = ex.repeticoes || '';
        
        const videoInput = document.getElementById('config-video');
        if(videoInput) videoInput.value = ex.videoUrl || '';

        document.getElementById('modal-config-series').style.display = 'flex';
    });

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
    ul.innerHTML = '';
    
    const exerciciosAtivos = seriesDoTemplateAtual[serieAtiva] || [];
    
    if (exerciciosAtivos.length === 0) {
        ul.innerHTML = `<p style="color: #aaa; text-align: center; padding: 16px; font-size: 14px;">A Ficha ${serieAtiva} está vazia. Adicione exercícios pelo catálogo.</p>`;
        return;
    }

    exerciciosAtivos.forEach((ex, index) => {
        ul.appendChild(criarItemExercicio(ex, index));
    });
}