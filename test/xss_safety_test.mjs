import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { escapeHtml } from '../public/script/utils/html.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const xssSensitiveFiles = [
    'public/script/dashboard.js',
    'public/script/modules/academia.js',
    'public/script/modules/feedbacks.js',
    'public/script/modules/loja.js',
    'public/script/modules/toast.js'
];

function readSource(relativePath) {
    return fs.readFileSync(
        path.join(projectRoot, relativePath),
        'utf8'
    );
}

test('escapeHtml neutraliza markup e atributos executaveis', () => {
    const payload = '<img src=x onerror="alert(1)">' +
        "' onclick='alert(2)' & `script`";

    assert.equal(
        escapeHtml(payload),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;' +
        '&#39; onclick=&#39;alert(2)&#39; &amp; &#96;script&#96;'
    );
});

test('escapeHtml preserva valores simples e trata nulos', () => {
    assert.equal(escapeHtml('Academia Okan'), 'Academia Okan');
    assert.equal(escapeHtml(0), '0');
    assert.equal(escapeHtml(false), 'false');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('sinks HTML sensiveis nao recebem interpolacao sem escape', () => {
    for (const relativePath of xssSensitiveFiles) {
        const source = readSource(relativePath);

        assert.doesNotMatch(
            source,
            /insertAdjacentHTML\s*\(/,
            `${relativePath}: insertAdjacentHTML nao e permitido`
        );

        assert.doesNotMatch(
            source,
            /document\.write\s*\(/,
            `${relativePath}: document.write nao e permitido`
        );

        assert.doesNotMatch(
            source,
            /\.outerHTML\s*=/,
            `${relativePath}: outerHTML nao e permitido`
        );

        assert.doesNotMatch(
            source,
            /\.innerHTML\s*=\s*[A-Za-z_$][\w$]*\s*;/,
            `${relativePath}: innerHTML nao pode receber variavel direta`
        );

        const templateAssignments =
            source.matchAll(/\.innerHTML\s*=\s*`([\s\S]*?)`/g);

        for (const assignment of templateAssignments) {
            const templateBody = assignment[1];
            const expressions =
                templateBody.matchAll(/\$\{([^}]+)\}/g);

            for (const expression of expressions) {
                assert.match(
                    expression[1].trim(),
                    /^escapeHtml\(/,
                    `${relativePath}: interpolacao em innerHTML deve usar escapeHtml()`
                );
            }
        }
    }
});

test('modal universal de exclusao usa texto, nao HTML arbitrario', () => {
    const source = readSource('public/script/dashboard.js');

    assert.doesNotMatch(source, /textoConfirmacao\.innerHTML/);
    assert.match(source, /textoConfirmacao\.textContent\s*=\s*mensagem/);
});
