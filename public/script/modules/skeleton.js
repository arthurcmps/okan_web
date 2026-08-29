export function renderSkeleton(tbodyId, colunas, linhas = 3) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    // Limpa a tabela atual sem interpretar HTML.
    tbody.replaceChildren();

    for (let i = 0; i < linhas; i++) {
        const tr = document.createElement('tr');
        tr.className = 'skeleton-row';

        for (let j = 0; j < colunas; j++) {
            const td = document.createElement('td');

            // Varia a largura da barra (entre 40% e 90%) para parecer dados reais.
            const width = Math.floor(Math.random() * 50) + 40;
            const box = document.createElement('div');
            box.className = 'skeleton-box';
            box.style.width = `${width}%`;

            td.appendChild(box);
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }
}
