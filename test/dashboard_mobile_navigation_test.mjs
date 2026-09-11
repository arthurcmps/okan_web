import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [dashboardHtml, dashboardScript, stylesheet] = await Promise.all([
    readFile(new URL('../public/dashboard.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/script/dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/css/style.css', import.meta.url), 'utf8'),
]);

test('mobile navigation keeps four primary destinations and one More control', () => {
    assert.match(stylesheet, /#menu-feedbacks\s*\{\s*display:\s*none;/);
    assert.match(stylesheet, /\.nav-links\s*\{[\s\S]*?overflow:\s*hidden;/);
    assert.match(stylesheet, /\.mobile-more-button\s*\{[\s\S]*?display:\s*flex;/);

    const primaryIds = [
        'menu-inicio',
        'menu-academias',
        'menu-professores',
        'menu-templates',
    ];

    for (const id of primaryIds) {
        assert.match(dashboardHtml, new RegExp(`id="${id}"`));
    }
});

test('More control and panel expose native accessible controls', () => {
    assert.match(
        dashboardHtml,
        /<button type="button" id="mobile-more-button"[^>]*aria-expanded="false"[^>]*aria-controls="mobile-more-menu"[^>]*aria-haspopup="dialog"[^>]*>/,
    );
    assert.match(
        dashboardHtml,
        /id="mobile-more-menu"[^>]*role="dialog"[^>]*aria-label="Mais opções do painel"[^>]*hidden/,
    );
    assert.match(dashboardHtml, /data-nav-proxy="menu-feedbacks"/);
    assert.match(dashboardHtml, /id="mobile-logout-button"/);
    assert.match(stylesheet, /\.mobile-more-action\s*\{[\s\S]*?min-height:\s*48px;/);
});

test('mobile proxies delegate to canonical navigation and logout handlers', () => {
    assert.match(dashboardScript, /document\.getElementById\(action\.dataset\.navProxy\)/);
    assert.match(dashboardScript, /target\?\.click\(\)/);
    assert.match(dashboardScript, /document\.getElementById\('logout-btn'\)\?\.click\(\)/);
    assert.match(dashboardScript, /link\.id === 'menu-feedbacks'/);
    assert.match(
        dashboardScript,
        /target\?\.click\(\);\s*fecharMenuMobileMais\(\{ restaurarFoco: true \}\)/,
    );
});

test('More panel supports Escape, outside click and role visibility sync', () => {
    assert.match(dashboardScript, /event\.key !== 'Escape'/);
    assert.match(dashboardScript, /mobileMoreMenu\.contains\(event\.target\)/);
    assert.match(dashboardScript, /target\.style\.display === 'none'/);
    assert.match(dashboardScript, /sincronizarOpcoesMobileMais\(\)/);
    assert.match(dashboardScript, /restaurarFoco:\s*true/);
    assert.match(dashboardScript, /Fechar mais opções do painel/);
    assert.match(dashboardScript, /Abrir mais opções do painel/);
});
