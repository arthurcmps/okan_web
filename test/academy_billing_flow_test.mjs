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
        "../public/script/services/academy-subscription-service.js",
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
    "checkout de academia usa callables canonicas",
    () => {
        assert.match(
            serviceSource,
            /obterCotacaoAssinaturaAcademia/,
        );
        assert.match(
            serviceSource,
            /iniciarAssinaturaAcademia/,
        );
        assert.match(
            academiaSource,
            /getAcademySubscriptionQuote\s*\(/,
        );
        assert.match(
            academiaSource,
            /startAcademySubscription\s*\(/,
        );
    },
);

test(
    "checkout nao usa endpoint nem preco legado como autoridade",
    () => {
        assert.doesNotMatch(
            academiaSource,
            /processarpagamentoweb/,
        );
        assert.doesNotMatch(
            academiaSource,
            /VALOR_MENSAL_LICENCA/,
        );
        assert.match(
            academiaSource,
            /amount:\s*quote\.monthlyAmount/,
        );
    },
);

test(
    "billing preserva regiao das functions B2B existentes",
    () => {
        assert.match(
            firebaseSource,
            /billingFunctions\s*=\s*getFunctions\(app,\s*["']us-central1["']\)/,
        );
        assert.match(
            serviceSource,
            /httpsCallable\(\s*billingFunctions/,
        );
    },
);

test(
    "academia paga habilita visualizacao pelo total server-side",
    () => {
        assert.match(
            academiaSource,
            /academiaAtualLicencasTotais\s*>\s*0\s*\?\s*["']Ativa["']/,
        );
    },
);