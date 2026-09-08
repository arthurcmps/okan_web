import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesheet = await readFile(
    new URL('../public/css/style.css', import.meta.url),
    'utf8',
);

const canonicalColors = new Map([
    ['background', '#120E16'],
    ['surface', '#1E1826'],
    ['primary', '#CCFF00'],
    ['secondary', '#E07A5F'],
    ['text-main', '#F2F0F5'],
    ['text-sub', '#9E9CAB'],
    ['text-muted', '#85818F'],
    ['error', '#FF453A'],
    ['warning', '#FFB020'],
]);

function relativeLuminance(hex) {
    const channels = hex
        .match(/[\dA-F]{2}/gi)
        .map((value) => Number.parseInt(value, 16) / 255)
        .map((value) => (
            value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4
        ));

    return (0.2126 * channels[0])
        + (0.7152 * channels[1])
        + (0.0722 * channels[2]);
}

function contrastRatio(first, second) {
    const luminances = [
        relativeLuminance(first),
        relativeLuminance(second),
    ].sort((left, right) => right - left);

    return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

test('web exposes the same canonical color tokens as the Flutter app', () => {
    for (const [name, value] of canonicalColors) {
        assert.match(
            stylesheet,
            new RegExp(`--okan-color-${name}:\\s*${value};`, 'i'),
        );
    }
});

test('core surfaces and actions consume semantic tokens', () => {
    const requiredContracts = [
        /body\s*\{[\s\S]*?background-color:\s*var\(--okan-color-background\)/,
        /\.login-box\s*\{[^}]*background-color:\s*var\(--okan-color-surface\)/,
        /\.panel-box\s*\{[^}]*background-color:\s*var\(--okan-color-surface\)/,
        /\.btn-primary\s*\{[^}]*background-color:\s*var\(--okan-color-primary\)/,
        /\.btn-danger\s*\{[^}]*background-color:\s*var\(--okan-color-error\)/,
        /\.input-group input:focus[^}]*border-color:\s*var\(--okan-color-primary\)/,
        /\.toast-info\s*\{[^}]*var\(--okan-color-info\)/,
    ];

    for (const contract of requiredContracts) {
        assert.match(stylesheet, contract);
    }
});

test('semantic text colors meet WCAG AA on the canonical surface', () => {
    const surface = canonicalColors.get('surface');

    for (const token of [
        'primary',
        'secondary',
        'text-main',
        'text-sub',
        'text-muted',
        'error',
        'warning',
    ]) {
        const ratio = contrastRatio(canonicalColors.get(token), surface);
        assert.ok(ratio >= 4.5, `${token} contrast is ${ratio.toFixed(2)}:1`);
    }
});

test('legacy palette is absent from central CSS rules', () => {
    for (const legacyColor of [
        '#00e676',
        '#00c853',
        '#121212',
        '#1e1e1e',
        '#ff5252',
        '#ff1744',
        '#2196f3',
    ]) {
        assert.doesNotMatch(stylesheet, new RegExp(legacyColor, 'i'));
    }
});
