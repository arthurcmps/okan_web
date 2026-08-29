import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { escapeHtml } from '../public/script/utils/html.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicScriptRoot = path.join(projectRoot, 'public', 'script');

function listJavaScriptFiles(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const absolutePath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                return listJavaScriptFiles(absolutePath);
            }

            if (!entry.isFile() || !/\.m?js$/i.test(entry.name)) {
                return [];
            }

            return [
                path
                    .relative(projectRoot, absolutePath)
                    .split(path.sep)
                    .join('/')
            ];
        });
}

const xssSensitiveFiles = listJavaScriptFiles(publicScriptRoot).sort();

function readSource(relativePath) {
    return fs.readFileSync(
        path.join(projectRoot, relativePath),
        'utf8'
    );
}

function assertSafeHtmlSinks(source, relativePath) {
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
        /\.innerHTML\s*\+=/,
        `${relativePath}: innerHTML incremental nao e permitido`
    );

    assert.doesNotMatch(
        source,
        /\.innerHTML\s*=\s*[A-Za-z_$][\w$.\[\]'\"]*\s*;/,
        `${relativePath}: innerHTML nao pode receber dado diretamente`
    );

    assert.doesNotMatch(
        source,
        /\.innerHTML\s*=\s*(?!sanitizeHtml\()[A-Za-z_$][\w$]*\s*\(/,
        `${relativePath}: innerHTML nao pode receber retorno dinamico sem sanitizacao explicita`
    );

    assert.doesNotMatch(
        source,
        /\.innerHTML\s*=\s*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*\+\s*[A-Za-z_$]/,
        `${relativePath}: concatenacao de string com dado dinamico em innerHTML nao e permitida`
    );

    assert.doesNotMatch(
        source,
        /\.innerHTML\s*=\s*[A-Za-z_$][\w$.\[\]'\"]*\s*\+\s*(?:'|")/,
        `${relativePath}: concatenacao de dado dinamico com string em innerHTML nao e permitida`
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

test('auditoria XSS cobre todos os scripts publicos da aplicacao', () => {
    assert.ok(xssSensitiveFiles.length > 0);
    assert.ok(xssSensitiveFiles.includes('public/script/dashboard.js'));
    assert.ok(xssSensitiveFiles.includes('public/script/register.js'));
    assert.ok(
        xssSensitiveFiles.includes('public/script/modules/skeleton.js')
    );
    assert.ok(
        xssSensitiveFiles.includes('public/script/modules/professores.js')
    );
});

test('sinks HTML publicos nao recebem conteudo dinamico inseguro', () => {
    for (const relativePath of xssSensitiveFiles) {
        assertSafeHtmlSinks(
            readSource(relativePath),
            relativePath
        );
    }
});

test('modal universal de exclusao usa texto, nao HTML arbitrario', () => {
    const source = readSource('public/script/dashboard.js');

    assert.doesNotMatch(source, /textoConfirmacao\.innerHTML/);
    assert.match(source, /textoConfirmacao\.textContent\s*=\s*mensagem/);
});

test('toast monta mensagem com DOM e textContent', () => {
    const source = readSource('public/script/modules/toast.js');

    assert.doesNotMatch(source, /toast\.innerHTML/);
    assert.match(
        source,
        /messageElement\.textContent\s*=\s*String\(message\s*\?\?\s*''\)/
    );
});
