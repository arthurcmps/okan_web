import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [dashboardHtml, stylesheet] = await Promise.all([
    readFile(new URL('../public/dashboard.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/css/style.css', import.meta.url), 'utf8'),
]);

const tableContracts = [
    ['table-academias-body', 'Academias cadastradas', 4],
    ['table-feedbacks-body', 'Feedbacks dos testadores', 5],
    ['table-professores-body', 'Professores vinculados à academia', 3],
    ['table-todos-professores-body', 'Professores cadastrados', 5],
    ['table-templates-body', 'Produtos da loja', 4],
];

test('all dashboard data tables opt in to the responsive contract', () => {
    for (const [bodyId, accessibleName] of tableContracts) {
        const tablePattern = new RegExp(
            `<table class="data-table responsive-table" aria-label="${accessibleName}">[\\s\\S]*?<tbody id="${bodyId}">`,
        );

        assert.match(dashboardHtml, tablePattern);
    }
});

test('mobile cards expose one visible label for every data column', () => {
    for (const [bodyId, , columnCount] of tableContracts) {
        for (let column = 1; column <= columnCount; column += 1) {
            assert.match(
                stylesheet,
                new RegExp(`#${bodyId} td:nth-child\\(${column}\\):not\\(\\[colspan\\]\\)::before \\{ content: "[^"]+"; \\}`),
            );
        }
    }
});

test('responsive tables stop forcing a wide mobile canvas', () => {
    assert.match(stylesheet, /\.responsive-table \{[\s\S]*?min-width: 0;/);
    assert.match(stylesheet, /\.responsive-table td \{[\s\S]*?overflow-wrap: anywhere;/);
    assert.doesNotMatch(
        stylesheet,
        /\.data-table \{\s*min-width:\s*600px;/,
    );
    assert.match(
        stylesheet,
        /padding: 20px 20px calc\(112px \+ env\(safe-area-inset-bottom\)\);/,
    );
});

test('desktop table headers remain available to assistive technology', () => {
    const headerRule = stylesheet.match(
        /\.responsive-table thead \{([^}]*)\}/,
    )?.[1];

    assert.ok(headerRule, 'responsive header rule must exist');
    assert.match(headerRule, /clip: rect\(0, 0, 0, 0\);/);
    assert.doesNotMatch(headerRule, /display:\s*none;/);
});
