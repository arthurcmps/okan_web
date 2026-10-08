import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyLinkCancelResult,
} from '../src/features/academies/academy-link-cancel-result.ts'

function createResult() {
  return {
    requestId: 'request_student_123456',
    academyId: 'academy-dev',
    status: 'cancelled',
    alreadyProcessed: false,
  }
}

test('valida cancelamento e retorna objeto imutavel', () => {
  const result = normalizeAcademyLinkCancelResult(createResult())

  assert.deepEqual(result, createResult())
  assert.equal(Object.isFrozen(result), true)
})

test('aceita confirmacao de cancelamento ja processado', () => {
  const result = normalizeAcademyLinkCancelResult({
    ...createResult(),
    alreadyProcessed: true,
  })

  assert.equal(result.alreadyProcessed, true)
  assert.equal(result.status, 'cancelled')
})

test('rejeita resposta ausente incompleta ou de tipo incorreto', () => {
  for (const value of [
    undefined,
    null,
    [],
    'invalid',
    {},
    { ...createResult(), alreadyProcessed: undefined },
    { ...createResult(), alreadyProcessed: 'true' },
    { ...createResult(), status: 'pending' },
    { ...createResult(), status: 'accepted' },
  ]) {
    assert.throws(
      () => normalizeAcademyLinkCancelResult(value),
      /INVALID_ACADEMY_LINK_CANCEL_RESPONSE/,
    )
  }
})

test('rejeita identificadores invalidos', () => {
  for (const changes of [
    { requestId: '' },
    { requestId: 'short' },
    { requestId: 'a'.repeat(81) },
    { requestId: 'request/student/123456' },
    { requestId: 'request_student_123456\n' },
    { academyId: '' },
    { academyId: 'invalid/id' },
    { academyId: ' academy-dev' },
  ]) {
    assert.throws(
      () => normalizeAcademyLinkCancelResult({
        ...createResult(),
        ...changes,
      }),
      /INVALID_ACADEMY_LINK_CANCEL_RESPONSE/,
    )
  }
})

test('descarta identidade e permissoes sem alterar original', () => {
  const original = {
    ...createResult(),
    userId: 'student-private',
    actorUid: 'manager-private',
    ticketId: 'ticket-private',
    roles: ['gym_admin'],
    membershipId: 'membership-private',
  }

  const copy = structuredClone(original)
  const result = normalizeAcademyLinkCancelResult(original)

  assert.deepEqual(result, createResult())
  assert.deepEqual(original, copy)
})