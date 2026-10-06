import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'

const expectedContext = {
  academyId: 'academia-dev',
  userId: 'gestor-dev',
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    membershipId: `membership_${'a'.repeat(64)}`,
    schemaVersion: 1,
    academyId: expectedContext.academyId,
    userId: expectedContext.userId,
    roles: ['gym_admin', 'aluno'],
    status: 'active',
    canManage: true,
    ...overrides,
  }
}

test('valida gestor com múltiplos papéis e preserva a origem', () => {
  const source = membership()
  const original = structuredClone(source)

  const result = normalizeAcademyMembershipContext(
    { membership: source },
    expectedContext,
  )

  assert.ok(result)
  assert.equal(result.canManage, true)
  assert.deepEqual(result.roles, ['aluno', 'gym_admin'])
  assert.deepEqual(source, original)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.roles), true)
})

test('aluno e professor ativos não recebem administração', () => {
  for (const role of ['aluno', 'professor']) {
    const result = normalizeAcademyMembershipContext(
      {
        membership: membership({
          roles: [role],
          canManage: false,
        }),
      },
      expectedContext,
    )

    assert.ok(result)
    assert.equal(result.canManage, false)
  }
})

test('estados não ativos retiram administração do gestor', () => {
  for (const status of ['pending', 'suspended', 'ended']) {
    const result = normalizeAcademyMembershipContext(
      {
        membership: membership({
          status,
          canManage: false,
        }),
      },
      expectedContext,
    )

    assert.ok(result)
    assert.equal(result.canManage, false)
  }
})

test('vínculo ausente exige null explícito', () => {
  assert.equal(
    normalizeAcademyMembershipContext(
      { membership: null },
      expectedContext,
    ),
    null,
  )

  for (const response of [{}, null, { membership: undefined }]) {
    assert.throws(() => {
      normalizeAcademyMembershipContext(response, expectedContext)
    })
  }
})

test('rejeita vínculo de outro usuário ou academia', () => {
  for (const overrides of [
    { userId: 'outro-usuario' },
    { academyId: 'outra-academia' },
  ]) {
    assert.throws(
      () => normalizeAcademyMembershipContext(
        { membership: membership(overrides) },
        expectedContext,
      ),
      /MEMBERSHIP_CONTEXT_MISMATCH/,
    )
  }
})

test('rejeita contratos e permissões inconsistentes', () => {
  const invalidOverrides = [
    { schemaVersion: 2 },
    { membershipId: 'id-invalido' },
    { roles: [] },
    { roles: ['gym_admin', 'gym_admin'] },
    { roles: ['super_admin'] },
    { status: 'unknown' },
    { canManage: 'true' },
    { canManage: false },
    { roles: ['aluno'], canManage: true },
    { status: 'suspended', canManage: true },
  ]

  for (const overrides of invalidOverrides) {
    assert.throws(() => {
      normalizeAcademyMembershipContext(
        { membership: membership(overrides) },
        expectedContext,
      )
    })
  }
})

test('descarta campos adicionais da resposta', () => {
  const result = normalizeAcademyMembershipContext(
    {
      membership: membership({
        privateNote: 'informação interna',
        billingData: { amount: 100 },
      }),
    },
    expectedContext,
  )

  assert.ok(result)
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'membershipId',
      'schemaVersion',
      'academyId',
      'userId',
      'roles',
      'status',
      'canManage',
    ].sort(),
  )
})

test('rejeita identificadores inválidos no contexto esperado', () => {
  for (const invalidId of ['', ' academia ', 'a/b', '.', '..']) {
    assert.throws(() => {
      normalizeAcademyMembershipContext(
        { membership: null },
        { ...expectedContext, academyId: invalidId },
      )
    })

    assert.throws(() => {
      normalizeAcademyMembershipContext(
        { membership: null },
        { ...expectedContext, userId: invalidId },
      )
    })
  }
})