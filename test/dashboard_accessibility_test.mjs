import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [dashboardHtml, dashboardScript, stylesheet] = await Promise.all([
    readFile(new URL('../public/dashboard.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/script/dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/css/style.css', import.meta.url), 'utf8'),
]);

test('dashboard navigation exposes labels, icons and keyboard semantics', () => {
    const navigation = dashboardHtml.match(
        /<ul class="nav-links"[\s\S]*?<\/ul>/,
    )?.[0];

    assert.ok(navigation, 'navigation list must exist');

    const items = [...navigation.matchAll(/<li id="menu-[^"]+"[^>]*>[\s\S]*?<\/li>/g)];
    assert.equal(items.length, 7);

    for (const [item] of items) {
        const target = item.match(/data-target="([^"]+)"/)?.[1];

        assert.ok(target, 'menu item must preserve its data-target');
        assert.match(item, /data-label="[^"]+"/);
        assert.match(item, /role="button"/);
        assert.match(item, /tabindex="0"/);
        assert.match(item, new RegExp(`aria-controls="section-${target}"`));
        assert.match(
            item,
            /<span class="material-symbols-outlined" aria-hidden="true">[^<]+<\/span>/,
        );
    }

    assert.match(navigation, /id="menu-inicio"[^>]*aria-current="page"/);
});

test('custom modal close controls can be named and reached by keyboard', () => {
    const closeControls = [
        ...dashboardHtml.matchAll(/<span class="close-btn"[^>]*>/g),
    ];

    assert.equal(closeControls.length, 6);

    for (const [control] of closeControls) {
        assert.match(control, /role="button"/);
        assert.match(control, /tabindex="0"/);
        assert.match(control, /aria-label="Fechar [^"]+"/);
    }

    assert.match(dashboardScript, /\.close-btn\[role="button"\]/);
    assert.match(dashboardScript, /event\.key !== 'Enter'/);
    assert.match(dashboardScript, /event\.key !== ' '/);
});

test('workout sheets use semantic tabs without changing their data contract', () => {
    const selector = dashboardHtml.match(
        /<div id="seletor-series"[\s\S]*?<\/div>/,
    )?.[0];

    assert.ok(selector, 'workout sheet selector must exist');
    assert.match(selector, /role="tablist"/);

    const tabs = [...selector.matchAll(/<button[^>]*data-serie="([A-E])"[^>]*>/g)];
    assert.deepEqual(tabs.map((match) => match[1]), ['A', 'B', 'C', 'D', 'E']);
    assert.equal(tabs.filter(([tab]) => tab.includes('aria-selected="true"')).length, 1);
});

test('active navigation and motion preferences remain explicit', () => {
    assert.match(dashboardScript, /removeAttribute\('aria-current'\)/);
    assert.match(dashboardScript, /setAttribute\('aria-current', 'page'\)/);
    assert.match(dashboardScript, /link\.dataset\.label/);
    assert.match(stylesheet, /\.nav-links li:focus-visible/);
    assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/);
});
