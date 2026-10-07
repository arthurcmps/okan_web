import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyStudentStatusResult,
} from '../src/features/academies/academy-student-status-result.ts'

import type {
  ExpectedStudentStatusResult,
} from '../src/features/academies/academy-student-status-result.ts'

const MEMBERSHIP_ID = `membership_${'a'.repeat(64)}`

const expected: ExpectedStudentStatusResult = {
  membershipId: MEMBERSHIP_ID,
  academyId: 'academy-dev',
  targetUid: 'student-dev',
  nextStatus: 'suspended',
}

function createResponse() {
  return {
    membershipId: MEMBERSHIP_ID,
    academyId: 'academy-dev',
    userId: 'student-dev',
    status: 'suspended',
    alreadyProcessed: false,
  }
}

test('valida suspensao e reativacao aplicadas', () => {
  const suspended = normalizeAcademyStudentStatusResult(
    createResponse(),
    expected,
  )

  assert.equal(suspended.status, 'suspended')
  assert.equal(suspended.alreadyProcessed, false)

  const activated = normalizeAcademyStudentStatusResult(
    { ...createResponse(), status: 'active' },
    { ...expected, nextStatus: 'active' },
  )

  assert.equal(activated.status, 'active')
  assert.equal(activated.userId, expected.targetUid)
})

test('repeticao preserva estado atual devolvido pelo backend', () => {
  for (const status of ['pending', 'active', 'suspended', 'ended']) {
    const result = normalizeAcademyStudentStatusResult(
      {
        ...createResponse(),
        status,
        alreadyProcessed: true,
      },
      expected,
    )

    assert.equal(result.status, status)
    assert.equal(result.alreadyProcessed, true)
  }
})

test('rejeita resposta de outro aluno academia ou vinculo', () => {
  for (const response of [
    { ...createResponse(), userId: 'another-student' },
    { ...createResponse(), academyId: 'another-academy' },
    {
      ...createResponse(),
      membershipId: `membership_${'b'.repeat(64)}`,
    },
  ]) {
    assert.throws(
      () => normalizeAcademyStudentStatusResult(response, expected),
      /STUDENT_STATUS_CONTEXT_MISMATCH/,
    )
  }
})

test('rejeita resposta incompleta invalida ou inconsistente', () => {
  for (const response of [
    null,
    [],
    {},
    { ...createResponse(), membershipId: undefined },
    { ...createResponse(), userId: undefined },
    { ...createResponse(), academyId: undefined },
    { ...createResponse(), status: 'unknown' },
    { ...createResponse(), alreadyProcessed: undefined },
    { ...createResponse(), alreadyProcessed: 'false' },
    { ...createResponse(), status: 'active' },
  ]) {
    assert.throws(
      () => normalizeAcademyStudentStatusResult(response, expected),
    )
  }
})

test('rejeita identificadores invalidos no contexto esperado', () => {
  for (const context of [
    { ...expected, membershipId: 'invalid' },
    { ...expected, academyId: ' academy-dev ' },
    { ...expected, targetUid: 'a/b' },
  ]) {
    assert.throws(
      () => normalizeAcademyStudentStatusResult(
        createResponse(),
        context,
      ),
      /INVALID_STUDENT_STATUS_CONTEXT/,
    )
  }
})

test('descarta campos extras e preserva resposta original', () => {
  const response = {
    ...createResponse(),
    email: 'student@example.com',
    cpf: 'valor-ficticio',
    roles: ['gym_admin'],
    internalNote: 'interno',
  }

  const original = structuredClone(response)

  const result = normalizeAcademyStudentStatusResult(
    response,
    expected,
  )

  assert.deepEqual(Object.keys(result).sort(), [
    'academyId',
    'alreadyProcessed',
    'membershipId',
    'status',
    'userId',
  ])

  assert.deepEqual(response, original)
  assert.equal(Object.isFrozen(result), true)
})