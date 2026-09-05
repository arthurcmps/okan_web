import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [dashboardHtml, professorsScript] = await Promise.all([
    readFile(new URL('../public/dashboard.html', import.meta.url), 'utf8'),
    readFile(
        new URL('../public/script/modules/professores.js', import.meta.url),
        'utf8',
    ),
]);

test('professor details use a named read-only dialog', () => {
    assert.match(
        dashboardHtml,
        /id="modal-detalhes-professor"[^>]*role="dialog"[^>]*aria-modal="true"/,
    );
    assert.match(
        dashboardHtml,
        /aria-labelledby="titulo-detalhes-professor"/,
    );

    for (const field of ['nome', 'email', 'vinculo', 'plano']) {
        assert.match(dashboardHtml, new RegExp(`id="prof-detalhe-${field}"`));
    }

    assert.doesNotMatch(dashboardHtml, /form-detalhes-professor/);
});

test('details button opens the dialog without another Firebase request', () => {
    assert.match(
        professorsScript,
        /btnDetalhes\.addEventListener\([\s\S]*?'click'[\s\S]*?abrirDetalhesProfessor\(prof, btnDetalhes\)/,
    );
    assert.match(professorsScript, /modalDetalhesProfessor\.style\.display = 'flex'/);
    const openDetailsFunction = professorsScript.match(
        /function abrirDetalhesProfessor\(prof, trigger\) \{([\s\S]*?)\n\}/,
    )?.[1];

    assert.ok(openDetailsFunction, 'details function must exist');
    assert.doesNotMatch(openDetailsFunction, /(getDoc|getDocs|collection|doc)\(/);
});

test('details render text safely and restore keyboard focus', () => {
    for (const field of ['nome', 'email', 'vinculo', 'plano']) {
        assert.match(
            professorsScript,
            new RegExp(`getElementById\\('prof-detalhe-${field}'\\)\\.textContent`),
        );
    }

    assert.doesNotMatch(professorsScript, /prof-detalhe-[^'\"]+['\"]\)\.innerHTML/);
    assert.match(professorsScript, /event\.key === 'Escape'/);
    assert.match(professorsScript, /focoAntesDosDetalhes\?\.focus\(\)/);
});
