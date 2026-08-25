import test from "node:test";
import assert from "node:assert/strict";

import {
    USER_ROLES,
    isCanonicalUser,
    normalizeUser,
    resolveUserRole
} from "../public/script/models/user-model.mjs";

test(
    "reads canonical User v2",
    () => {
        const user = normalizeUser(
            {
                schemaVersion: 2,
                uid: "wrong-payload-id",
                name: "Usuário Teste",
                email: "teste@example.com",
                role: "professor",
                academyId: "academy-1",
                professorId: null
            },
            "user-1"
        );

        assert.equal(user.uid, "user-1");
        assert.equal(user.schemaVersion, 2);
        assert.equal(user.name, "Usuário Teste");
        assert.equal(
            user.role,
            USER_ROLES.professor
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
                nome: "Usuário Legado",
                email: "legado@example.com",
                tipo: "personal",
                academiaId: "academy-old",
                personalId: "personal-old"
            },
            "legacy-1"
        );

        assert.equal(user.uid, "legacy-1");
        assert.equal(user.schemaVersion, 1);
        assert.equal(
            user.name,
            "Usuário Legado"
        );
        assert.equal(
            user.role,
            USER_ROLES.professor
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