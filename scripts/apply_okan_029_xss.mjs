import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function replaceExactlyOnce(content, before, after, label) {
    const first = content.indexOf(before);
    if (first < 0) {
        throw new Error(`${label}: bloco esperado nao encontrado`);
    }

    const second = content.indexOf(before, first + before.length);
    if (second >= 0) {
        throw new Error(`${label}: bloco esperado aparece mais de uma vez`);
    }

    return content.slice(0, first) +
        after +
        content.slice(first + before.length);
}

function replaceExactCount(content, before, after, expectedCount, label) {
    let count = 0;
    let cursor = 0;

    while (true) {
        const index = content.indexOf(before, cursor);
        if (index < 0) break;
        count++;
        cursor = index + before.length;
    }

    if (count !== expectedCount) {
        throw new Error(
            `${label}: esperado ${expectedCount}, encontrado ${count}`
        );
    }

    return content.split(before).join(after);
}

function updateFile(relativePath, updater) {
    const absolutePath = path.join(root, relativePath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const usesCrLf = raw.includes('\r\n');
    const normalized = raw.replace(/\r\n/g, '\n');
    const updated = updater(normalized);

    if (updated === normalized) {
        throw new Error(`${relativePath}: nenhuma alteracao aplicada`);
    }

    const output = usesCrLf
        ? updated.replace(/\n/g, '\r\n')
        : updated;

    fs.writeFileSync(absolutePath, output, 'utf8');
}

updateFile('public/script/dashboard.js', (source) => {
    source = replaceExactlyOnce(
        source,
        "function confirmarExclusao(mensagemHtml, acaoConfirmada) {\n    textoConfirmacao.innerHTML = mensagemHtml;",
        "function confirmarExclusao(mensagem, acaoConfirmada) {\n    textoConfirmacao.textContent = mensagem;",
        'dashboard confirmation sink'
    );

    return source;
});

updateFile('public/script/modules/toast.js', (source) => {
    source = replaceExactlyOnce(
        source,
        "    const toast = document.createElement('div');\n    toast.className = `toast toast-${type}`;",
        "    const toast = document.createElement('div');\n    const safeType = ['success', 'error', 'info'].includes(type)\n        ? type\n        : 'info';\n    toast.className = `toast toast-${safeType}`;",
        'toast safe type'
    );

    source = replaceExactCount(
        source,
        "type === 'success'",
        "safeType === 'success'",
        1,
        'toast success branch'
    );

    source = replaceExactCount(
        source,
        "type === 'error'",
        "safeType === 'error'",
        1,
        'toast error branch'
    );

    source = replaceExactlyOnce(
        source,
        "    // Estrutura interna do Toast\n    toast.innerHTML = `\n        <span class=\"material-symbols-outlined toast-icon\" style=\"color: ${color};\">${icon}</span>\n        <span style=\"flex-grow: 1;\">${message}</span>\n    `;",
        "    // Estrutura interna do Toast sem interpretar HTML da mensagem.\n    const iconElement = document.createElement('span');\n    iconElement.className = 'material-symbols-outlined toast-icon';\n    iconElement.style.color = color;\n    iconElement.textContent = icon;\n\n    const messageElement = document.createElement('span');\n    messageElement.style.flexGrow = '1';\n    messageElement.textContent = String(message ?? '');\n\n    toast.append(iconElement, messageElement);",
        'toast message sink'
    );

    return source;
});

updateFile('public/script/modules/feedbacks.js', (source) => {
    source = replaceExactlyOnce(
        source,
        "import { renderSkeleton } from \"./skeleton.js\";",
        "import { renderSkeleton } from \"./skeleton.js\";\nimport { escapeHtml } from \"../utils/html.js\";",
        'feedbacks escape import'
    );

    const replacements = [
        ['${dataFormatada}', '${escapeHtml(dataFormatada)}', 'feedback date'],
        ['${fb.nota}', '${escapeHtml(fb.nota)}', 'feedback rating'],
        ["${fb.confuso || '--'}", "${escapeHtml(fb.confuso || '--')}", 'feedback confusion'],
        ["${fb.bugs || '--'}", "${escapeHtml(fb.bugs || '--')}", 'feedback bugs'],
        ["${fb.gostou || '--'}", "${escapeHtml(fb.gostou || '--')}", 'feedback liked']
    ];

    for (const [before, after, label] of replacements) {
        source = replaceExactlyOnce(source, before, after, label);
    }

    return source;
});

updateFile('public/script/modules/academia.js', (source) => {
    source = replaceExactlyOnce(
        source,
        "import { showToast } from \"./toast.js\";",
        "import { showToast } from \"./toast.js\";\nimport { escapeHtml } from \"../utils/html.js\";",
        'academia escape import'
    );

    const licenseBefore = "document.getElementById('detalhe-licencas').innerHTML = `${academiaAtualLicencasUsadas} de <strong style=\"color:white;\">${academiaAtualLicencasTotais}</strong> em uso`;";
    const licenseAfter = "document.getElementById('detalhe-licencas').innerHTML = `${escapeHtml(academiaAtualLicencasUsadas)} de <strong style=\"color:white;\">${escapeHtml(academiaAtualLicencasTotais)}</strong> em uso`;";

    source = replaceExactCount(
        source,
        licenseBefore,
        licenseAfter,
        3,
        'academy license display'
    );

    source = replaceExactlyOnce(
        source,
        "                <td style=\"font-weight: bold;\">${acad.nome}</td><td>${acad.emailGestor}</td>\n                <td><span style=\"color: #00e676;\">${acad.licencasUsadas || 0}</span> / ${acad.licencasTotais || 0}</td>",
        "                <td style=\"font-weight: bold;\">${escapeHtml(acad.nome)}</td><td>${escapeHtml(acad.emailGestor)}</td>\n                <td><span style=\"color: #00e676;\">${escapeHtml(acad.licencasUsadas || 0)}</span> / ${escapeHtml(acad.licencasTotais || 0)}</td>",
        'academy table data'
    );

    source = replaceExactlyOnce(
        source,
        "Tem a certeza que deseja excluir a academia <strong>\"${acad.nome}\"</strong>?",
        "Tem a certeza que deseja excluir a academia \"${acad.nome}\"?",
        'academy delete confirmation'
    );

    source = replaceExactlyOnce(
        source,
        "tr.innerHTML = `<td><strong>${prof.email}</strong></td><td><span style=\"color: ${statusColor}; border: 1px solid ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;\">${prof.status}</span></td><td><button class=\"action-btn btn-delete-prof\" style=\"color: #ff5252;\" title=\"Remover Licença\"><span class=\"material-symbols-outlined\" style=\"font-size: 18px;\">person_remove</span></button></td>`;",
        "tr.innerHTML = `<td><strong>${escapeHtml(prof.email)}</strong></td><td><span style=\"color: ${escapeHtml(statusColor)}; border: 1px solid ${escapeHtml(statusColor)}; padding: 4px 8px; border-radius: 4px; font-size: 12px;\">${escapeHtml(prof.status)}</span></td><td><button class=\"action-btn btn-delete-prof\" style=\"color: #ff5252;\" title=\"Remover Licença\"><span class=\"material-symbols-outlined\" style=\"font-size: 18px;\">person_remove</span></button></td>`;",
        'academy professor table data'
    );

    source = replaceExactlyOnce(
        source,
        "Remover o acesso Premium de <strong>${prof.email}</strong>?",
        "Remover o acesso Premium de ${prof.email}?",
        'academy professor delete confirmation'
    );

    return source;
});

updateFile('public/script/modules/loja.js', (source) => {
    source = replaceExactlyOnce(
        source,
        "import { db } from \"../firebase.js\";",
        "import { db } from \"../firebase.js\";\nimport { escapeHtml } from \"../utils/html.js\";",
        'store escape import'
    );

    source = replaceExactlyOnce(
        source,
        "label.innerHTML = `<input type=\"checkbox\" value=\"${tag}\"> ${tag}`;",
        "label.innerHTML = `<input type=\"checkbox\" value=\"${escapeHtml(tag)}\"> ${escapeHtml(tag)}`;",
        'store tag chips'
    );

    source = replaceExactlyOnce(
        source,
        "infoDiv.innerHTML = `<strong style=\"color: white;\">${ex.nome}</strong><br><span style=\"color: #aaa; font-size: 12px;\">${ex.grupo || 'Sem grupo'}</span>`;",
        "infoDiv.innerHTML = `<strong style=\"color: white;\">${escapeHtml(ex.nome)}</strong><br><span style=\"color: #aaa; font-size: 12px;\">${escapeHtml(ex.grupo || 'Sem grupo')}</span>`;",
        'store exercise catalog data'
    );

    source = replaceExactlyOnce(
        source,
        "const infoFichas = qtdFichas > 0 ? `<span style=\"color: #00e676; font-weight:bold;\">${qtdFichas} Ficha(s)</span> • ` : '';",
        "const infoFichas = qtdFichas > 0 ? `${qtdFichas} Ficha(s) • ` : '';",
        'store template sheet label'
    );

    source = replaceExactlyOnce(
        source,
        "                <td style=\"font-weight: bold;\">${tpl.nome}</td>\n                <td style=\"color: #ff5252;\">${precoStr}</td>\n                <td style=\"font-size: 12px; color: #aaa;\">${infoFichas}${tagsStr}</td>",
        "                <td style=\"font-weight: bold;\">${escapeHtml(tpl.nome)}</td>\n                <td style=\"color: #ff5252;\">${escapeHtml(precoStr)}</td>\n                <td style=\"font-size: 12px; color: #aaa;\">${escapeHtml(infoFichas)}${escapeHtml(tagsStr)}</td>",
        'store template row data'
    );

    source = replaceExactlyOnce(
        source,
        "Remover o treino <strong>\"${tpl.nome}\"</strong> da loja oficial?<br>Os professores que já compraram continuarão a ter acesso.",
        "Remover o treino \"${tpl.nome}\" da loja oficial? Os professores que já compraram continuarão a ter acesso.",
        'store delete confirmation'
    );

    source = replaceExactlyOnce(
        source,
        "ul.innerHTML = `<p style=\"color: #aaa; text-align: center; padding: 16px; font-size: 14px;\">A Ficha ${serieAtiva} está vazia. Adicione exercícios pelo catálogo.</p>`;",
        "ul.innerHTML = `<p style=\"color: #aaa; text-align: center; padding: 16px; font-size: 14px;\">A Ficha ${escapeHtml(serieAtiva)} está vazia. Adicione exercícios pelo catálogo.</p>`;",
        'store empty sheet message'
    );

    return source;
});

console.log('OKAN-029 XSS migration applied successfully.');
console.log('Changed dashboard, toast, feedbacks, academia and loja rendering only.');
