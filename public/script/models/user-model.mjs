export const USER_ROLES = Object.freeze({
    aluno: "aluno",
    professor: "professor",
    gymAdmin: "gym_admin",
    superAdmin: "super_admin",
    unresolved: "unresolved"
});

const CANONICAL_ROLES = new Set([
    USER_ROLES.aluno,
    USER_ROLES.professor,
    USER_ROLES.gymAdmin,
    USER_ROLES.superAdmin
]);

function stringFrom(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();

    return normalized === ""
        ? null
        : normalized;
}

function schemaVersionFrom(value) {
    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        return Math.trunc(value);
    }

    return 1;
}

function hasStudentMarkers(data) {
    const markers = [
        "personalId",
        "professorId",
        "peso",
        "weight",
        "altura",
        "objetivo",
        "objectives",
        "birthDate",
        "dataNascimento"
    ];

    return markers.some(
        (field) =>
            Object.prototype.hasOwnProperty.call(
                data,
                field
            )
    );
}

export function resolveUserRole(data = {}) {
    const role =
        stringFrom(data.role)?.toLowerCase();

    // Role canônico sempre tem precedência sobre `tipo`.
    if (role) {
        if (CANONICAL_ROLES.has(role)) {
            return role;
        }

        if (role === "personal") {
            return USER_ROLES.professor;
        }
    }

    const tipo =
        stringFrom(data.tipo)?.toLowerCase();

    if (tipo === "personal") {
        return USER_ROLES.professor;
    }

    if (tipo === "aluno") {
        return USER_ROLES.aluno;
    }

    if (hasStudentMarkers(data)) {
        return USER_ROLES.aluno;
    }

    // Nunca inferimos privilégios elevados.
    return USER_ROLES.unresolved;
}

export function normalizeUser(
    data = {},
    documentId = ""
) {
    return Object.freeze({
        schemaVersion:
            schemaVersionFrom(data.schemaVersion),

        // O documentId é a fonte de verdade.
        uid: documentId,

        name:
            stringFrom(data.name) ??
            stringFrom(data.nome) ??
            "",

        email:
            stringFrom(data.email) ?? "",

        role:
            resolveUserRole(data),

        photoUrl:
            stringFrom(data.photoUrl),

        academyId:
            stringFrom(data.academyId) ??
            stringFrom(data.academiaId),

        professorId:
            stringFrom(data.professorId) ??
            stringFrom(data.personalId)
    });
}

export function isCanonicalUser(user) {
    return (
        user &&
        user.schemaVersion >= 2 &&
        CANONICAL_ROLES.has(user.role)
    );
}