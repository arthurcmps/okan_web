import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyLinkRequestResult,
} from '../src/features/academies/academy-link-request-result.ts'

function createResponse() {
  return {
    requestId: 'request_student_123456',
    expiresAtMs: 604801000,
  }
}

test('valida confirmacao do envio sem conceder vinculo', () => {
  const result = normalizeAcademyLinkRequestResult(createResponse())

  assert.deepEqual(result, createResponse())
  assert.equal(Object.isFrozen(result), true)
})

test('rejeita resposta ausente incompleta ou de tipo incorreto', () => {
  for (const response of [
    null,
    undefined,
    [],
    {},
    'request',
    { ...createResponse(), requestId: undefined },
    { ...createResponse(), expiresAtMs: undefined },
  ]) {
    assert.throws(
      () => normalizeAcademyLinkRequestResult(response),
      /INVALID_ACADEMY_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('rejeita identificador de solicitacao invalido', () => {
  for (const requestId of [
    '',
    'short',
    'a'.repeat(81),
    'request/student/123456',
    ' request_student_123456',
    'request_student_123456\n',
  ]) {
    assert.throws(
      () => normalizeAcademyLinkRequestResult({
        ...createResponse(),
        requestId,
      }),
      /INVALID_ACADEMY_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('aceita identificadores nos limites de tamanho', () => {
  for (const requestId of ['a'.repeat(16), 'b'.repeat(80)]) {
    assert.equal(
      normalizeAcademyLinkRequestResult({
        ...createResponse(),
        requestId,
      }).requestId,
      requestId,
    )
  }
})

test('rejeita validade invalida', () => {
  for (const expiresAtMs of [
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '604801000',
  ]) {
    assert.throws(
      () => normalizeAcademyLinkRequestResult({
        ...createResponse(),
        expiresAtMs,
      }),
      /INVALID_ACADEMY_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('descarta identidade e permissoes extras sem alterar original', () => {
  const response = {
    ...createResponse(),
    targetUid: 'student-private',
    email: 'aluno@example.com',
    roles: ['gym_admin'],
    status: 'active',
  }

  const original = structuredClone(response)
  const result = normalizeAcademyLinkRequestResult(response)

  assert.deepEqual(result, createResponse())
  assert.deepEqual(response, original)
})