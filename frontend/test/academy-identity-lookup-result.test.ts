import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyIdentityLookupResult,
} from '../src/features/academies/academy-identity-lookup-result.ts'

function createResponse() {
  return {
    ticketId: `lookup_${'a'.repeat(64)}`,
    expiresAtMs: 301000,
  }
}

test('ausencia de resultado retorna null', () => {
  assert.equal(normalizeAcademyIdentityLookupResult(null), null)
})

test('valida ticket temporario e retorna objeto imutavel', () => {
  const result = normalizeAcademyIdentityLookupResult(createResponse())

  assert.deepEqual(result, createResponse())
  assert.equal(Object.isFrozen(result), true)
})

test('rejeita resposta incompleta ou tipo incorreto', () => {
  for (const response of [
    undefined,
    [],
    {},
    'ticket',
    { ...createResponse(), ticketId: undefined },
    { ...createResponse(), expiresAtMs: undefined },
  ]) {
    assert.throws(
      () => normalizeAcademyIdentityLookupResult(response),
      /INVALID_IDENTITY_LOOKUP_RESPONSE/,
    )
  }
})

test('rejeita identificador de ticket invalido', () => {
  for (const ticketId of [
    '',
    'lookup_abc',
    `lookup_${'A'.repeat(64)}`,
    `lookup_${'g'.repeat(64)}`,
    `lookup_${'a'.repeat(65)}`,
    ` lookup_${'a'.repeat(64)}`,
  ]) {
    assert.throws(
      () => normalizeAcademyIdentityLookupResult({
        ...createResponse(),
        ticketId,
      }),
      /INVALID_IDENTITY_LOOKUP_RESPONSE/,
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
    '301000',
  ]) {
    assert.throws(
      () => normalizeAcademyIdentityLookupResult({
        ...createResponse(),
        expiresAtMs,
      }),
      /INVALID_IDENTITY_LOOKUP_RESPONSE/,
    )
  }
})

test('descarta campos extras sem alterar resposta original', () => {
  const response = {
    ...createResponse(),
    targetUid: 'student-private',
    email: 'aluno@example.com',
    roles: ['gym_admin'],
  }

  const original = structuredClone(response)
  const result = normalizeAcademyIdentityLookupResult(response)

  assert.deepEqual(result, createResponse())
  assert.deepEqual(response, original)
})