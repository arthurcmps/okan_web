import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const registerSource = await readFile(
    new URL(
        "../public/script/register.js",
        import.meta.url,
    ),
    "utf8",
);

const serviceSource = await readFile(
    new URL(
        "../public/script/services/academy-registration-service.js",
        import.meta.url,
    ),
    "utf8",
);

test(
    "cadastro de academia delega privilegios ao backend",
    () => {
        assert.match(
            registerSource,
            /registerAcademy\s*\(/,
        );

        assert.doesNotMatch(
            registerSource,
            /writeBatch\s*\(/,
        );

        assert.doesNotMatch(
            registerSource,
            /role\s*:\s*USER_ROLES\.gymAdmin/,
        );

        assert.doesNotMatch(
            registerSource,
            /academyId\s*:/,
        );
    },
);

test(
    "service usa callable canonica registerAcademy",
    () => {
        assert.match(
            serviceSource,
            /httpsCallable\(functions,\s*["']registerAcademy["']\)/,
        );
    },
);
