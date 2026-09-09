import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setupPasswordVisibility } from '../public/script/modules/password-visibility.js';

const load = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [login, register, loginScript, registerScript, controls, css] =
    await Promise.all([
        load('../public/index.html'),
        load('../public/register.html'),
        load('../public/script/script.js'),
        load('../public/script/register.js'),
        load('../public/script/modules/password-visibility.js'),
        load('../public/css/style.css'),
    ]);

test('preserves authentication forms and Firebase entry points', () => {
    assert.match(login, /<form id="login-form"/);
    assert.match(login, /<input type="email" id="email"/);
    assert.match(login, /<input type="password" id="password"/);
    assert.match(login, /<button type="submit" id="login-btn"/);
    assert.match(loginScript, /signInWithEmailAndPassword\(auth, email, password\)/);
    assert.match(loginScript, /signInWithPopup\(auth, provider\)/);

    assert.match(register, /<form id="register-form"/);
    assert.match(register, /<button type="submit" id="register-btn"/);
    assert.match(registerScript, /createUserWithEmailAndPassword\(/);
    assert.match(registerScript, /await registerAcademy\(\{/);
});

test('password visibility controls never submit and remain independent', () => {
    assert.match(login, /type="button" id="toggle-password"/);
    assert.match(login, /aria-controls="password"/);
    assert.match(register, /type="button" id="toggle-reg-password"/);
    assert.match(register, /aria-controls="reg-password"/);
    assert.match(register, /type="button" id="toggle-reg-confirm-password"/);
    assert.match(register, /aria-controls="reg-confirm-password"/);
    assert.match(registerScript, /inputId: "reg-password"/);
    assert.match(registerScript, /inputId: "reg-confirm-password"/);
    assert.match(controls, /input\.type = shouldShow \? "text" : "password"/);
});

test('password controls reveal and mask only their associated field', () => {
    const input = { type: 'password' };
    const confirmation = { type: 'password' };
    const listeners = new Map();
    const attributes = new Map();
    const toggle = {
        textContent: 'Mostrar',
        addEventListener: (event, callback) => listeners.set(event, callback),
        setAttribute: (name, value) => attributes.set(name, value),
    };
    const elements = new Map([
        ['password-under-test', input],
        ['confirmation-under-test', confirmation],
        ['toggle-under-test', toggle],
    ]);
    const previousDocument = global.document;

    global.document = {
        getElementById: (id) => elements.get(id) ?? null,
    };

    try {
        setupPasswordVisibility({
            inputId: 'password-under-test',
            toggleId: 'toggle-under-test',
        });

        listeners.get('click')();
        assert.equal(input.type, 'text');
        assert.equal(confirmation.type, 'password');
        assert.equal(toggle.textContent, 'Ocultar');
        assert.equal(attributes.get('aria-pressed'), 'true');
        assert.equal(attributes.get('aria-label'), 'Ocultar senha');

        listeners.get('click')();
        assert.equal(input.type, 'password');
        assert.equal(toggle.textContent, 'Mostrar');
        assert.equal(attributes.get('aria-pressed'), 'false');
    } finally {
        if (previousDocument === undefined) {
            delete global.document;
        } else {
            global.document = previousDocument;
        }
    }
});

test('feedback, busy state and privacy affordances are accessible', () => {
    for (const page of [login, register]) {
        assert.match(page, /id="error-message"[^>]*role="status"/);
        assert.match(page, /aria-live="polite"/);
    }

    assert.match(loginScript, /setAttribute\('aria-busy', 'true'\)/);
    assert.match(registerScript, /setAttribute\("aria-busy", "true"\)/);
    assert.match(register, /href="privacidade\.html"/);
    assert.match(css, /\.auth-feedback\s*\{[^}]*min-height:\s*44px/);
    assert.match(css, /\.password-toggle:focus-visible/);
});

test('customer-facing product name is consistent across auth pages', () => {
    assert.match(login, /Okan para Academias/);
    assert.match(register, /Okan para Academias/);
});
