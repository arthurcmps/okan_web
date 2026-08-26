export const USER_ROLES = Object.freeze({
    aluno: "aluno",
    professor: "professor",
    gymAdmin: "gym_admin",
    superAdmin: "super_admin",
    unresolved: "unresolved"
});

export const MEMBER_TYPES = Object.freeze({
    aluno: "aluno",
    professor: "professor"
});

const CANONICAL_ROLES = new Set([
    USER_ROLES.aluno,
    USER_ROLES.professor,
    USER_ROLES.gymAdmin,
    USER_ROLES.superAdmin
]);

const CANONICAL_MEMBER_TYPES = new Set([
    MEMBER_TYPES.aluno,
    MEMBER_TYPES.professor
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

    /*
     * Role representa autorizaÃ§Ã£o/RBAC.
     *
     * Um valor canÃ´nico sempre tem precedÃªncia
     * sobre campos legados como `tipo`.
     */
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

    /*
     * Marcadores de aluno sÃ³ sÃ£o usados quando
     * nÃ£o existe role explÃ­cita.
     *
     * Nunca inferimos privilÃ©gios elevados.
     */
    if (hasStudentMarkers(data)) {
        return USER_ROLES.aluno;
    }

    return USER_ROLES.unresolved;
}

export function resolveMemberType(data = {}) {
    const memberType =
        stringFrom(data.memberType)
            ?.toLowerCase();

    /*
     * memberType canÃ´nico tem precedÃªncia
     * sobre a representaÃ§Ã£o legada `tipo`.
     */
    if (
        memberType &&
        CANONICAL_MEMBER_TYPES.has(
            memberType
        )
    ) {
        return memberType;
    }

    const tipo =
        stringFrom(data.tipo)
            ?.toLowerCase();

    /*
     * No app legado:
     *
     * tipo=aluno
     * tipo=personal
     *
     * representam a persona funcional mobile.
     */
    if (tipo === "aluno") {
        return MEMBER_TYPES.aluno;
    }

    if (tipo === "personal") {
        return MEMBER_TYPES.professor;
    }

    /*
     * Para usuÃ¡rios comuns, role tambÃ©m pode
     * fornecer a persona quando nÃ£o existe tipo.
     *
     * Para gym_admin/super_admin nÃ£o inferimos
     * persona automaticamente.
     */
    const role =
        resolveUserRole(data);

    if (role === USER_ROLES.aluno) {
        return MEMBER_TYPES.aluno;
    }

    if (role === USER_ROLES.professor) {
        return MEMBER_TYPES.professor;
    }

    return null;
}

export function normalizeUser(
    data = {},
    documentId = ""
) {
    return Object.freeze({
        schemaVersion:
            schemaVersionFrom(
                data.schemaVersion
            ),

        /*
         * O ID do documento Ã© a fonte
         * de verdade para UID.
         */
        uid: documentId,

        name:
            stringFrom(data.name) ??
            stringFrom(data.nome) ??
            "",

        email:
            stringFrom(data.email) ??
            "",

        /*
         * role:
         * autorizaÃ§Ã£o / RBAC.
         *
         * memberType:
         * persona funcional do app.
         */
        role:
            resolveUserRole(data),

        memberType:
            resolveMemberType(data),

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
