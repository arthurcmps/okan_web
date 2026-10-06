import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAcademyMembershipContext
} from "../public/script/models/academy-membership-context.mjs";

const context = {
  academyId: "academia-dev",
  userId: "usuario-dev"
};

function makeResponse(overrides = {}) {
  return {
    membership: {
      membershipId: `membership_${"a".repeat(64)}`,
      schemaVersion: 1,
      academyId: context.academyId,
      userId: context.userId,
      roles: ["gym_admin"],
      status: "active",
      canManage: true,
      ...overrides
    }
  };
}

test("normaliza gestor com multiplos papeis sem alterar resposta", () => {
  const response = makeResponse({
    roles: ["professor", "gym_admin", "aluno"]
  });

  const result = normalizeAcademyMembershipContext(response, context);

  assert.deepEqual(result.roles, ["aluno", "gym_admin", "professor"]);
  assert.equal(result.canManage, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.roles), true);

  assert.deepEqual(
    response.membership.roles,
    ["professor", "gym_admin", "aluno"]
  );
});

test("aceita ausencia explicita e rejeita resposta incompleta", () => {
  assert.equal(
    normalizeAcademyMembershipContext({ membership: null }, context),
    null
  );

  for (const response of [null, {}, [], { membership: undefined }]) {
    assert.throws(
      () => normalizeAcademyMembershipContext(response, context)
    );
  }
});

test("rejeita resposta de outro usuario ou academia", () => {
  for (const overrides of [
    { userId: "outro-usuario" },
    { academyId: "outra-academia" }
  ]) {
    assert.throws(
      () => normalizeAcademyMembershipContext(
        makeResponse(overrides),
        context
      ),
      { message: "MEMBERSHIP_CONTEXT_MISMATCH" }
    );
  }
});

test("aluno e estados nao ativos permanecem sem administracao", () => {
  const student = normalizeAcademyMembershipContext(
    makeResponse({ roles: ["aluno"], canManage: false }),
    context
  );

  assert.equal(student.canManage, false);

  for (const status of ["pending", "suspended", "ended"]) {
    const result = normalizeAcademyMembershipContext(
      makeResponse({ status, canManage: false }),
      context
    );

    assert.equal(result.status, status);
    assert.equal(result.canManage, false);

    assert.throws(
      () => normalizeAcademyMembershipContext(
        makeResponse({ status, canManage: true }),
        context
      ),
      { message: "INVALID_MEMBERSHIP_PERMISSION" }
    );
  }
});

test("rejeita contrato e permissao inconsistentes", () => {
  for (const overrides of [
    { schemaVersion: 99 },
    { membershipId: "id-invalido" },
    { roles: ["super_admin"] },
    { roles: ["gym_admin", "gym_admin"] },
    { status: "desconhecido" },
    { canManage: "true" },
    { canManage: false },
    { roles: ["aluno"], canManage: true }
  ]) {
    assert.throws(
      () => normalizeAcademyMembershipContext(
        makeResponse(overrides),
        context
      )
    );
  }

  assert.throws(
    () => normalizeAcademyMembershipContext(makeResponse()),
    { message: "INVALID_MEMBERSHIP_CONTEXT" }
  );
});

test("descarta campos internos adicionais", () => {
  const result = normalizeAcademyMembershipContext(
    makeResponse({
      privateNote: "Informacao interna",
      createdBy: "outro-usuario"
    }),
    context
  );

  assert.deepEqual(Object.keys(result).sort(), [
    "academyId",
    "canManage",
    "membershipId",
    "roles",
    "schemaVersion",
    "status",
    "userId"
  ]);
});