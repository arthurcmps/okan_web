import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
    applicationDefault,
    initializeApp
} from "firebase-admin/app";

import {
    getFirestore
} from "firebase-admin/firestore";

import {
    normalizeUser,
    USER_ROLES
} from "../public/script/models/user-model.mjs";

const PROJECT_ID = "app-academia-2914d";
const COLLECTION_NAME = "users";
const TARGET_SCHEMA_VERSION = 2;

// Mantemos uma margem abaixo dos limites operacionais do Firestore.
const BATCH_SIZE = 400;

const args = process.argv.slice(2);

const APPLY = args.includes("--apply");

const confirmProjectArg =
    args.find(
        (arg) =>
            arg.startsWith("--confirm-project=")
    );

const confirmedProject =
    confirmProjectArg
        ?.split("=")
        .slice(1)
        .join("=");

if (
    APPLY &&
    confirmedProject !== PROJECT_ID
) {
    console.error(
        "\nERRO: --apply exige confirmacao explicita do projeto."
    );

    console.error(
        `Use: --confirm-project=${PROJECT_ID}`
    );

    process.exit(2);
}

const app = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID
});

const db = getFirestore(app);

function timestampForFile() {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

function isPlainObject(value) {
    if (
        value === null ||
        typeof value !== "object"
    ) {
        return false;
    }

    const prototype =
        Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

/*
 * Converte tipos comuns do Firestore para um JSON
 * legivel. Este backup e logico: serve para auditoria
 * e recuperacao manual, nao para importacao automatica.
 */
function toJsonSafe(value) {
    if (
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return value ?? null;
    }

    if (Array.isArray(value)) {
        return value.map(toJsonSafe);
    }

    if (Buffer.isBuffer(value)) {
        return {
            __type: "bytes",
            base64: value.toString("base64")
        };
    }

    if (
        typeof value.toDate === "function" &&
        typeof value.seconds === "number"
    ) {
        return {
            __type: "timestamp",
            iso: value.toDate().toISOString(),
            seconds: value.seconds,
            nanoseconds:
                value.nanoseconds ?? 0
        };
    }

    if (
        typeof value.toBase64 === "function"
    ) {
        return {
            __type: "bytes",
            base64: value.toBase64()
        };
    }

    if (
        typeof value.latitude === "number" &&
        typeof value.longitude === "number"
    ) {
        return {
            __type: "geopoint",
            latitude: value.latitude,
            longitude: value.longitude
        };
    }

    if (
        typeof value.path === "string" &&
        value.constructor?.name
            ?.toLowerCase()
            .includes("documentreference")
    ) {
        return {
            __type: "documentReference",
            path: value.path
        };
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(
                    ([key, nestedValue]) => [
                        key,
                        toJsonSafe(nestedValue)
                    ]
                )
        );
    }

    return String(value);
}

function buildPatch(
    raw,
    documentId
) {
    const normalized =
        normalizeUser(
            raw,
            documentId
        );

    /*
     * Nunca migramos um usuario cujo papel nao
     * conseguimos determinar com seguranca.
     */
    if (
        normalized.role ===
        USER_ROLES.unresolved
    ) {
        return {
            normalized,
            patch: null,
            unresolved: true
        };
    }

    const patch = {};

    /*
     * Somente promovemos versoes antigas.
     * Nunca fazemos downgrade caso apareca uma
     * versao futura maior que 2.
     */
    if (
        normalized.schemaVersion <
        TARGET_SCHEMA_VERSION
    ) {
        patch.schemaVersion =
            TARGET_SCHEMA_VERSION;
    }

    /*
     * O ID do documento e a fonte de verdade.
     */
    if (raw.uid !== documentId) {
        patch.uid = documentId;
    }

    /*
     * Campos canonicos basicos.
     */
    if (
        raw.name !== normalized.name
    ) {
        patch.name =
            normalized.name;
    }

    if (
        raw.email !== normalized.email
    ) {
        patch.email =
            normalized.email;
    }

    if (
        raw.role !== normalized.role
    ) {
        patch.role =
            normalized.role;
    }

    /*
     * Relacionamentos canonicos.
     *
     * Nao removemos academiaId/personalId nesta fase.
     */
    if (
        normalized.academyId !== null &&
        normalized.academyId !== undefined &&
        raw.academyId !==
            normalized.academyId
    ) {
        patch.academyId =
            normalized.academyId;
    }

    if (
        normalized.professorId !== null &&
        normalized.professorId !== undefined &&
        raw.professorId !==
            normalized.professorId
    ) {
        patch.professorId =
            normalized.professorId;
    }

    return {
        normalized,
        patch,
        unresolved: false
    };
}

function hasChanges(patch) {
    return (
        patch &&
        Object.keys(patch).length > 0
    );
}

async function writeJson(
    filePath,
    value
) {
    await fs.writeFile(
        filePath,
        JSON.stringify(
            value,
            null,
            2
        ),
        "utf8"
    );
}

function chunkArray(
    items,
    size
) {
    const chunks = [];

    for (
        let index = 0;
        index < items.length;
        index += size
    ) {
        chunks.push(
            items.slice(
                index,
                index + size
            )
        );
    }

    return chunks;
}

async function main() {
    console.log(
        "\n========================================"
    );

    console.log(
        " OKAN - User v2 migration"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Project : ${PROJECT_ID}`
    );

    console.log(
        `Collection: ${COLLECTION_NAME}`
    );

    console.log(
        `Mode    : ${
            APPLY
                ? "APPLY"
                : "DRY-RUN"
        }`
    );

    console.log(
        "========================================\n"
    );

    const snapshot =
        await db
            .collection(
                COLLECTION_NAME
            )
            .get();

    console.log(
        `Usuarios encontrados: ${snapshot.size}`
    );

    const records =
        snapshot.docs.map(
            (docSnap) => {
                const raw =
                    docSnap.data();

                const migration =
                    buildPatch(
                        raw,
                        docSnap.id
                    );

                return {
                    id: docSnap.id,
                    ref: docSnap.ref,
                    raw,
                    normalized:
                        migration.normalized,
                    patch:
                        migration.patch,
                    unresolved:
                        migration.unresolved
                };
            }
        );

    const unresolved =
        records.filter(
            (record) =>
                record.unresolved
        );

    const changes =
        records.filter(
            (record) =>
                !record.unresolved &&
                hasChanges(
                    record.patch
                )
        );

    const unchanged =
        records.filter(
            (record) =>
                !record.unresolved &&
                !hasChanges(
                    record.patch
                )
        );

    console.log(
        `Ja canonicos/sem alteracao: ${unchanged.length}`
    );

    console.log(
        `Precisam de migracao      : ${changes.length}`
    );

    console.log(
        `Role unresolved           : ${unresolved.length}`
    );

    if (changes.length > 0) {
        console.log(
            "\n--- ALTERACOES PROPOSTAS ---"
        );

        for (const record of changes) {
            console.log(
                `${record.id}: ${
                    Object.keys(
                        record.patch
                    ).join(", ")
                }`
            );
        }
    }

    if (unresolved.length > 0) {
        console.log(
            "\n--- USUARIOS NAO RESOLVIDOS ---"
        );

        for (
            const record
            of unresolved
        ) {
            console.log(
                `${record.id}: role=${
                    record.raw.role ??
                    "<ausente>"
                }, tipo=${
                    record.raw.tipo ??
                    "<ausente>"
                }`
            );
        }
    }

    const outputDirectory =
        path.resolve(
            "migration-output"
        );

    await fs.mkdir(
        outputDirectory,
        {
            recursive: true
        }
    );

    const stamp =
        timestampForFile();

    /*
     * O relatorio nao inclui nome ou e-mail.
     * Serve para revisar exatamente quais campos
     * seriam alterados.
     */
    const reportPath =
        path.join(
            outputDirectory,
            `users-v2-report-${stamp}.json`
        );

    await writeJson(
        reportPath,
        {
            generatedAt:
                new Date().toISOString(),

            projectId:
                PROJECT_ID,

            mode:
                APPLY
                    ? "apply"
                    : "dry-run",

            total:
                records.length,

            unchanged:
                unchanged.length,

            changes:
                changes.map(
                    (record) => ({
                        id:
                            record.id,

                        patch:
                            toJsonSafe(
                                record.patch
                            )
                    })
                ),

            unresolved:
                unresolved.map(
                    (record) => ({
                        id:
                            record.id,

                        role:
                            record.raw.role ??
                            null,

                        tipo:
                            record.raw.tipo ??
                            null
                    })
                )
        }
    );

    console.log(
        `\nRelatorio local: ${reportPath}`
    );

    /*
     * DRY-RUN termina aqui.
     *
     * Nenhuma escrita no Firestore e executada.
     */
    if (!APPLY) {
        console.log(
            "\nDRY-RUN concluido."
        );

        console.log(
            "Nenhum documento foi alterado no Firestore."
        );

        return;
    }

    /*
     * Uma role unresolved bloqueia toda a migracao.
     */
    if (unresolved.length > 0) {
        console.error(
            "\nAPPLY CANCELADO."
        );

        console.error(
            "Existem usuarios com role unresolved."
        );

        console.error(
            "Nenhuma escrita foi realizada."
        );

        process.exitCode = 3;
        return;
    }

    if (changes.length === 0) {
        console.log(
            "\nNenhuma migracao necessaria."
        );

        return;
    }

    /*
     * Backup logico completo ANTES das escritas.
     */
    const backupPath =
        path.join(
            outputDirectory,
            `users-backup-before-v2-${stamp}.json`
        );

    await writeJson(
        backupPath,
        {
            generatedAt:
                new Date().toISOString(),

            projectId:
                PROJECT_ID,

            collection:
                COLLECTION_NAME,

            documents:
                records.map(
                    (record) => ({
                        id:
                            record.id,

                        data:
                            toJsonSafe(
                                record.raw
                            )
                    })
                )
        }
    );

    console.log(
        `Backup local: ${backupPath}`
    );

    const chunks =
        chunkArray(
            changes,
            BATCH_SIZE
        );

    console.log(
        `\nLotes a executar: ${chunks.length}`
    );

    let migrated = 0;

    for (
        let index = 0;
        index < chunks.length;
        index += 1
    ) {
        const chunk =
            chunks[index];

        const batch =
            db.batch();

        for (
            const record
            of chunk
        ) {
            /*
             * merge=true:
             * adiciona/corrige somente os campos canonicos
             * calculados no patch e preserva todo o restante.
             */
            batch.set(
                record.ref,
                record.patch,
                {
                    merge: true
                }
            );
        }

        await batch.commit();

        migrated +=
            chunk.length;

        console.log(
            `Lote ${index + 1}/${chunks.length}: ` +
            `${chunk.length} usuarios migrados`
        );
    }

    console.log(
        "\n========================================"
    );

    console.log(
        `Migracao concluida: ${migrated} usuarios`
    );

    console.log(
        "Campos legados foram preservados."
    );

    console.log(
        "========================================"
    );
}

main().catch(
    (error) => {
        console.error(
            "\nERRO FATAL NA MIGRACAO:"
        );

        console.error(error);

        process.exitCode = 1;
    }
);
