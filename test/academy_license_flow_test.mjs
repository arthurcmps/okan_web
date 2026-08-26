import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const academiaSource = await readFile(
    new URL(
        "../public/script/modules/academia.js",
        import.meta.url,
    ),
    "utf8",
);

const serviceSource = await readFile(
    new URL(
        "../public/script/services/academy-license-service.js",
        import.meta.url,
    ),
    "utf8",
);

const firebaseSource = await readFile(
    new URL(
        "../public/script/firebase.js",
        import.meta.url,
    ),
    "utf8",
);

test(
    "painel delega concessao e remocao de licencas ao backend",
    () => {
        assert.match(
            academiaSource,
            /grantAcademyLicense\s*\(/,
        );

        assert.match(
            academiaSource,
            /revokeAcademyLicense\s*\(/,
        );

        assert.doesNotMatch(
            academiaSource,
            /increment\s*\(/,
        );

        assert.doesNotMatch(
            academiaSource,
            /addDoc\s*\(\s*collection\(\s*db\s*,\s*["']academias["']\s*,\s*academiaAtualId\s*,\s*["']professores["']/,
        );
    },
);

test(
    "service usa callables canonicas de licenca",
    () => {
        assert.match(
            serviceSource,
            /httpsCallable\(functions,\s*["']grantAcademyLicense["']\)/,
        );

        assert.match(
            serviceSource,
            /httpsCallable\(functions,\s*["']revokeAcademyLicense["']\)/,
        );
    },
);

test(
    "functions web aponta para a regiao canonica",
    () => {
        assert.match(
            firebaseSource,
            /getFunctions\(app,\s*["']southamerica-east1["']\)/,
        );
    },
);
