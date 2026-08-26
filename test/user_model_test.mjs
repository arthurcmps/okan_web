import test from "node:test";
import assert from "node:assert/strict";

import {
    MEMBER_TYPES,
    USER_ROLES,
    isCanonicalUser,
    normalizeUser,
    resolveMemberType,
    resolveUserRole
} from "../public/script/models/user-model.mjs";

test(
    "reads canonical User v2",
    () => {
        const user = normalizeUser(
            {
                schemaVersion: 2,
                uid: "wrong-payload-id",
                name: "UsuÃ¡rio Teste",
                email: "teste@example.com",
                role: "professor",
                memberType: "professor",
                academyId: "academy-1",
                professorId: null
            },
            "user-1"
        );

        assert.equal(
            user.uid,
            "user-1"
        );

        assert.equal(
            user.schemaVersion,
            2
        );

        assert.equal(
            user.name,
            "UsuÃ¡rio Teste"
        );

        assert.equal(
            user.role,
            USER_ROLES.professor
        );

        assert.equal(
            user.memberType,
            MEMBER_TYPES.professor
        );

        assert.equal(
            user.academyId,
            "academy-1"
        );

        assert.equal(
            isCanonicalUser(user),
            true
        );
    }
);

test(
    "reads legacy Portuguese fields",
    () => {
        const user = normalizeUser(
            {
                nome: "UsuÃ¡rio Legado",
                email: "legado@example.com",
                tipo: "personal",
                academiaId: "academy-old",
                personalId: "personal-old"
            },
            "legacy-1"
        );

        assert.equal(
            user.uid,
            "legacy-1"
        );

        assert.equal(
            user.schemaVersion,
            1
        );

        assert.equal(
            user.name,
            "UsuÃ¡rio Legado"
        );

        assert.equal(
            user.role,
            USER_ROLES.professor
        );

        assert.equal(
            user.memberType,
            MEMBER_TYPES.professor
        );

        assert.equal(
            user.academyId,
            "academy-old"
        );

        assert.equal(
            user.professorId,
            "personal-old"
        );
    }
);

test(
    "canonical role wins over conflicting tipo",
    () => {
        const role = resolveUserRole({
            role: "super_admin",
            tipo: "aluno"
        });

        assert.equal(
            role,
            USER_ROLES.superAdmin
        );
    }
);

test(
    "super admin can also be an aluno member",
    () => {
        const user = normalizeUser(
            {
                schemaVersion: 2,
                role: "super_admin",
                tipo: "aluno"
            },
            "admin-student"
        );

        assert.equal(
            user.role,
            USER_ROLES.superAdmin
        );

        assert.equal(
            user.memberType,
            MEMBER_TYPES.aluno
        );
    }
);

test(
    "super admin can also be a professor member",
    () => {
        const user = normalizeUser(
            {
                schemaVersion: 2,
                role: "super_admin",
                tipo: "personal"
            },
            "admin-professor"
        );

        assert.equal(
            user.role,
            USER_ROLES.superAdmin
        );

        assert.equal(
            user.memberType,
            MEMBER_TYPES.professor
        );
    }
);

test(
    "canonical memberType wins over conflicting tipo",
    () => {
        const memberType =
            resolveMemberType({
                role: "super_admin",
                memberType: "professor",
                tipo: "aluno"
            });

        assert.equal(
            memberType,
            MEMBER_TYPES.professor
        );
    }
);

test(
    "gym admin without mobile persona has null memberType",
    () => {
        const user = normalizeUser(
            {
                schemaVersion: 2,
                role: "gym_admin"
            },
            "gym-admin-1"
        );

        assert.equal(
            user.role,
            USER_ROLES.gymAdmin
        );

        assert.equal(
            user.memberType,
            null
        );
    }
);

test(
    "legacy personal role becomes professor",
    () => {
        const role = resolveUserRole({
            role: "personal"
        });

        assert.equal(
            role,
            USER_ROLES.professor
        );
    }
);

test(
    "legacy tipo personal becomes professor",
    () => {
        const role = resolveUserRole({
            tipo: "personal"
        });

        assert.equal(
            role,
            USER_ROLES.professor
        );
    }
);

test(
    "legacy tipo personal becomes professor member",
    () => {
        const memberType =
            resolveMemberType({
                tipo: "personal"
            });

        assert.equal(
            memberType,
            MEMBER_TYPES.professor
        );
    }
);

test(
    "student markers resolve missing role as aluno",
    () => {
        const role = resolveUserRole({
            weight: 80,
            personalId: "professor-1"
        });

        assert.equal(
            role,
            USER_ROLES.aluno
        );
    }
);

test(
    "role aluno provides aluno member type",
    () => {
        const memberType =
            resolveMemberType({
                role: "aluno"
            });

        assert.equal(
            memberType,
            MEMBER_TYPES.aluno
        );
    }
);

test(
    "unknown user remains unresolved",
    () => {
        const role = resolveUserRole({
            email: "unknown@example.com"
        });

        assert.equal(
            role,
            USER_ROLES.unresolved
        );
    }
);

test(
    "unknown user has no member type",
    () => {
        const memberType =
            resolveMemberType({
                email: "unknown@example.com"
            });

        assert.equal(
            memberType,
            null
        );
    }
);

test(
    "document id is source of truth",
    () => {
        const user = normalizeUser(
            {
                uid: "wrong-id",
                role: "aluno"
            },
            "correct-id"
        );

        assert.equal(
            user.uid,
            "correct-id"
        );
    }
);
