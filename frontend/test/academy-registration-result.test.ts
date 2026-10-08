import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyRegistrationResult,
} from '../src/features/academies/academy-registration-result.ts'

test('valida confirmacao de cadastro e retorna objeto imutavel', () => {
  const result = normalizeAcademyRegistrationResult({
    academyId: 'academy-dev',
    alreadyRegistered: false,
  })

  assert.deepEqual(result, {
    academyId: 'academy-dev',
    alreadyRegistered: false,
  })

  assert.equal(Object.isFrozen(result), true)
})

test('aceita confirmacao de cadastro ja existente', () => {
  const result = normalizeAcademyRegistrationResult({
    academyId: 'academy-dev',
    alreadyRegistered: true,
  })

  assert.equal(result.alreadyRegistered, true)
})

test('rejeita resposta ausente incompleta ou de tipo incorreto', () => {
  const invalidResponses: unknown[] = [
    undefined,
    null,
    false,
    'academy-dev',
    [],
    {},
    { academyId: 'academy-dev' },
    { alreadyRegistered: false },
    {
      academyId: 'academy-dev',
      alreadyRegistered: 'false',
    },
    {
      academyId: 'academy-dev',
      alreadyRegistered: 0,
    },
  ]

  for (const response of invalidResponses) {
    assert.throws(
      () => normalizeAcademyRegistrationResult(response),
      /INVALID_ACADEMY_REGISTRATION_RESPONSE/,
    )
  }
})

test('rejeita identificadores invalidos', () => {
  const invalidIdentifiers: unknown[] = [
    undefined,
    null,
    123,
    '',
    ' ',
    '.',
    '..',
    'academias/academy-dev',
    ' academy-dev',
    'academy-dev ',
  ]

  for (const academyId of invalidIdentifiers) {
    assert.throws(
      () => normalizeAcademyRegistrationResult({
        academyId,
        alreadyRegistered: false,
      }),
      /INVALID_ACADEMY_REGISTRATION_RESPONSE/,
    )
  }
})

test('descarta identidade e permissoes extras sem alterar original', () => {
  const response = {
    academyId: 'academy-dev',
    alreadyRegistered: false,
    userId: 'gestor-dev',
    email: 'gestor@teste.com',
    role: 'super_admin',
    canManage: true,
    licencasTotais: 999,
  }

  const original = { ...response }
  const result = normalizeAcademyRegistrationResult(response)

  assert.deepEqual(result, {
    academyId: 'academy-dev',
    alreadyRegistered: false,
  })

  assert.deepEqual(response, original)
})