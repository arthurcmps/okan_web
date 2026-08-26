import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
    applicationDefault,
    initializeApp
} from "firebase-admin/app";

import {
    FieldValue,
    getFirestore
} from "firebase-admin/firestore";

import {
    MEMBER_TYPES,
    normalizeUser
} from "../public/script/models/user-model.mjs";

const PROJECT_ID =
    "app-academia-2914d";

const SOURCE_ID =
    "QW2IJ8WCxlS0LA0EjbzU7d3WzPN2";

const EXPECTED_TARGET_ID =
    "sLKkEQBRawVjFwJrjXi5F87QfWC2";

const EXPECTED_CONFIRMATION =
    `${SOURCE_ID}:${EXPECTED_TARGET_ID}`;

const args =
    process.argv.slice(2);

const APPLY =
    args.includes("--apply");

const confirmProjectArg =
    args.find(
        (arg) =>
            arg.startsWith(
                "--confirm-project="
            )
    );

const confirmRepairArg =
    args.find(
        (arg) =>
            arg.startsWith(
                "--confirm-repair="
            )
    );

const confirmedProject =
    confirmProjectArg
        ?.split("=")
        .slice(1)
        .join("=");

const confirmedRepair =
    confirmRepairArg
        ?.split("=")
        .slice(1)
        .join("=");

if (APPLY) {
    if (
        confirmedProject !== PROJECT_ID
    ) {
        console.error(
            "\nERRO: projeto nao confirmado."
        );

        console.error(
            `Use --confirm-project=${PROJECT_ID}`
        );

        process.exit(2);
    }

    if (
        confirmedRepair !==
        EXPECTED_CONFIRMATION
    ) {
        console.error(
            "\nERRO: reparo nao confirmado."
        );

        console.error(
            "Use:"
        );

        console.error(
            `--confirm-repair=${EXPECTED_CONFIRMATION}`
        );

        process.exit(2);
    }
}

const app =
    initializeApp({
        credential:
            applicationDefault(),

        projectId:
            PROJECT_ID
    });

const db =
    getFirestore(app);

function timestampForFile() {
    return new Date()
        .toISOString()
        .replace(
            /[:.]/g,
            "-"
        );
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
        prototype ===
            Object.prototype ||
        prototype === null
    );
}

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
        return value.map(
            toJsonSafe
        );
    }

    if (Buffer.isBuffer(value)) {
        return {
            __type: "bytes",
            base64:
                value.toString(
                    "base64"
                )
        };
    }

    if (
        typeof value.toDate ===
            "function" &&
        typeof value.seconds ===
            "number"
    ) {
        return {
            __type: "timestamp",

            iso:
                value
                    .toDate()
                    .toISOString(),

            seconds:
                value.seconds,

            nanoseconds:
                value.nanoseconds ?? 0
        };
    }

    if (
        typeof value.toBase64 ===
        "function"
    ) {
        return {
            __type: "bytes",
            base64:
                value.toBase64()
        };
    }

    if (
        typeof value.latitude ===
            "number" &&
        typeof value.longitude ===
            "number"
    ) {
        return {
            __type: "geopoint",
            latitude:
                value.latitude,
            longitude:
                value.longitude
        };
    }

    if (
        typeof value.path ===
            "string" &&
        value.constructor?.name
            ?.toLowerCase()
            .includes(
                "documentreference"
            )
    ) {
        return {
            __type:
                "documentReference",

            path:
                value.path
        };
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(
                    ([
                        key,
                        nestedValue
                    ]) => [
                        key,
                        toJsonSafe(
                            nestedValue
                        )
                    ]
                )
        );
    }

    return String(value);
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

async function getRelatedInvites() {
    const byStudent =
        await db
            .collection("invites")
            .where(
                "studentUid",
                "==",
                SOURCE_ID
            )
            .get();

    const byTarget =
        await db
            .collection("invites")
            .where(
                "personalId",
                "==",
                EXPECTED_TARGET_ID
            )
            .get();

    const inviteMap =
        new Map();

    for (
        const docSnap
        of [
            ...byStudent.docs,
            ...byTarget.docs
        ]
    ) {
        inviteMap.set(
            docSnap.id,
            {
                id:
                    docSnap.id,

                data:
                    docSnap.data()
            }
        );
    }

    return [
        ...inviteMap.values()
    ];
}

async function main() {
    console.log(
        "\n========================================"
    );

    console.log(
        " OKAN - Invalid professor link repair"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Project : ${PROJECT_ID}`
    );

    console.log(
        `Source  : ${SOURCE_ID}`
    );

    console.log(
        `Target  : ${EXPECTED_TARGET_ID}`
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

    const sourceRef =
        db
            .collection("users")
            .doc(SOURCE_ID);

    const targetRef =
        db
            .collection("users")
            .doc(
                EXPECTED_TARGET_ID
            );

    const [
        sourceSnapshot,
        targetSnapshot
    ] =
        await Promise.all([
            sourceRef.get(),
            targetRef.get()
        ]);

    if (!sourceSnapshot.exists) {
        throw new Error(
            "SOURCE_NOT_FOUND"
        );
    }

    if (!targetSnapshot.exists) {
        throw new Error(
            "TARGET_NOT_FOUND"
        );
    }

    const sourceRaw =
        sourceSnapshot.data();

    const targetRaw =
        targetSnapshot.data();

    const source =
        normalizeUser(
            sourceRaw,
            SOURCE_ID
        );

    const target =
        normalizeUser(
            targetRaw,
            EXPECTED_TARGET_ID
        );

    console.log(
        "Source memberType:",
        source.memberType
    );

    console.log(
        "Target memberType:",
        target.memberType
    );

    console.log(
        "Source professorId:",
        sourceRaw.professorId ??
            null
    );

    console.log(
        "Source personalId:",
        sourceRaw.personalId ??
            null
    );

    /*
     * Idempotence:
     * if both relationship fields are gone,
     * there is nothing left to repair.
     */
    if (
        sourceRaw.professorId == null &&
        sourceRaw.personalId == null
    ) {
        console.log(
            "\nNenhum reparo necessario."
        );

        console.log(
            "O vinculo ja esta ausente."
        );

        return;
    }

    /*
     * Strict preconditions.
     *
     * We only repair the exact state that
     * was previously audited.
     */
    if (
        source.memberType !==
        MEMBER_TYPES.aluno
    ) {
        throw new Error(
            "SOURCE_IS_NOT_ALUNO_MEMBER"
        );
    }

    if (
        target.memberType !==
        MEMBER_TYPES.aluno
    ) {
        throw new Error(
            "TARGET_IS_NO_LONGER_ALUNO_MEMBER"
        );
    }

    if (
        sourceRaw.professorId != null &&
        sourceRaw.professorId !==
            EXPECTED_TARGET_ID
    ) {
        throw new Error(
            "CANONICAL_TARGET_CHANGED"
        );
    }

    if (
        sourceRaw.personalId != null &&
        sourceRaw.personalId !==
            EXPECTED_TARGET_ID
    ) {
        throw new Error(
            "LEGACY_TARGET_CHANGED"
        );
    }

    const fieldsToDelete = [
        "professorId",
        "personalId",
        "personalName",
        "inviteFromPersonalId"
    ];

    const fieldsCurrentlyPresent =
        fieldsToDelete.filter(
            (field) =>
                Object.prototype
                    .hasOwnProperty
                    .call(
                        sourceRaw,
                        field
                    )
        );

    const relatedInvites =
        await getRelatedInvites();

    console.log(
        "\n--- REPARO PROPOSTO ---"
    );

    console.log(
        "Documento:",
        SOURCE_ID
    );

    console.log(
        "Campos a remover:",
        fieldsCurrentlyPresent.join(
            ", "
        ) || "<nenhum>"
    );

    console.log(
        "Convites relacionados encontrados:",
        relatedInvites.length
    );

    console.log(
        "Convites serao alterados: 0"
    );

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

    const reportPath =
        path.join(
            outputDirectory,
            `repair-professor-link-report-${stamp}.json`
        );

    await writeJson(
        reportPath,
        {
            generatedAt:
                new Date()
                    .toISOString(),

            projectId:
                PROJECT_ID,

            mode:
                APPLY
                    ? "apply"
                    : "dry-run",

            sourceId:
                SOURCE_ID,

            expectedTargetId:
                EXPECTED_TARGET_ID,

            sourceMemberType:
                source.memberType,

            targetMemberType:
                target.memberType,

            fieldsCurrentlyPresent,

            relatedInviteIds:
                relatedInvites.map(
                    (invite) =>
                        invite.id
                ),

            inviteDocumentsModified:
                0
        }
    );

    console.log(
        "\nRelatorio local:",
        reportPath
    );

    if (!APPLY) {
        console.log(
            "\nDRY-RUN concluido."
        );

        console.log(
            "Nenhum documento foi alterado no Firestore."
        );

        return;
    }

    const backupPath =
        path.join(
            outputDirectory,
            `repair-professor-link-backup-${stamp}.json`
        );

    await writeJson(
        backupPath,
        {
            generatedAt:
                new Date()
                    .toISOString(),

            projectId:
                PROJECT_ID,

            source: {
                id:
                    SOURCE_ID,

                data:
                    toJsonSafe(
                        sourceRaw
                    )
            },

            target: {
                id:
                    EXPECTED_TARGET_ID,

                data:
                    toJsonSafe(
                        targetRaw
                    )
            },

            relatedInvites:
                relatedInvites.map(
                    (invite) => ({
                        id:
                            invite.id,

                        data:
                            toJsonSafe(
                                invite.data
                            )
                    })
                )
        }
    );

    console.log(
        "Backup local:",
        backupPath
    );

    await sourceRef.update({
        professorId:
            FieldValue.delete(),

        personalId:
            FieldValue.delete(),

        personalName:
            FieldValue.delete(),

        inviteFromPersonalId:
            FieldValue.delete()
    });

    const afterSnapshot =
        await sourceRef.get();

    const afterRaw =
        afterSnapshot.data();

    const after =
        normalizeUser(
            afterRaw,
            SOURCE_ID
        );

    const legacyStillPresent =
        [
            "personalId",
            "personalName",
            "inviteFromPersonalId"
        ].filter(
            (field) =>
                Object.prototype
                    .hasOwnProperty
                    .call(
                        afterRaw,
                        field
                    )
        );

    if (
        after.professorId !== null ||
        legacyStillPresent.length > 0
    ) {
        throw new Error(
            "POST_REPAIR_VERIFICATION_FAILED"
        );
    }

    console.log(
        "\n========================================"
    );

    console.log(
        "Reparo concluido com sucesso."
    );

    console.log(
        "professorId removido."
    );

    console.log(
        "Campos legados de vinculo removidos."
    );

    console.log(
        "Convites historicos preservados."
    );

    console.log(
        "========================================"
    );
}

main().catch(
    (error) => {
        console.error(
            "\nERRO FATAL NO REPARO:"
        );

        console.error(
            error
        );

        process.exitCode = 1;
    }
);
