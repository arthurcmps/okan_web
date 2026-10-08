import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyProfileResult,
  normalizeAcademyProfileUpdateResult,
} from '../src/features/academies/academy-profile-result.ts'

function validResponse() {
  return {
    academy: {
      academyId: 'academy-dev',
      nome: 'Academia de teste',
      cnpj: '12.345.678/0001-90',
      telefoneResponsavel: '(21) 99999-9999',
      cep: '25000-000',
      endereco: 'Rua de teste, 123',
      bairro: 'Centro',
      uf: 'RJ',
      emailGestor: 'gestor@teste.com',
    },
    revision: 0,
  }
}

test('valida cadastro e retorna estruturas imutaveis', () => {
  const response = validResponse()

  const result = normalizeAcademyProfileResult(
    response,
    'academy-dev',
  )

  assert.deepEqual(result, response)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.academy), true)
})

test('aceita campos opcionais vazios de cadastro legado', () => {
  const response = validResponse()

  const result = normalizeAcademyProfileResult({
    ...response,
    academy: {
      ...response.academy,
      cnpj: '',
      telefoneResponsavel: '',
      cep: '',
      endereco: '',
      bairro: '',
      uf: '',
      emailGestor: '',
    },
  }, 'academy-dev')

  assert.equal(result.academy.cnpj, '')
  assert.equal(result.academy.emailGestor, '')
})

test('rejeita resposta incompleta e revisao invalida', () => {
  for (const response of [
    undefined,
    null,
    [],
    {},
    { academy: validResponse().academy },
    { ...validResponse(), revision: -1 },
    { ...validResponse(), revision: 1.5 },
    { ...validResponse(), revision: '0' },
    { ...validResponse(), revision: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.throws(
      () => normalizeAcademyProfileResult(response, 'academy-dev'),
      /INVALID_ACADEMY_PROFILE_RESPONSE/,
    )
  }

  for (const field of Object.keys(validResponse().academy)) {
    if (field === 'academyId') {
      continue
    }

    assert.throws(
      () => normalizeAcademyProfileResult({
        ...validResponse(),
        academy: {
          ...validResponse().academy,
          [field]: undefined,
        },
      }, 'academy-dev'),
      /INVALID_ACADEMY_PROFILE_RESPONSE/,
    )
  }
})

test('rejeita nome invalido e textos com tipos incorretos', () => {
  for (const nome of ['', ' Academia ', 'a'.repeat(201), 'A\nB']) {
    assert.throws(
      () => normalizeAcademyProfileResult({
        ...validResponse(),
        academy: { ...validResponse().academy, nome },
      }, 'academy-dev'),
      /INVALID_ACADEMY_PROFILE_RESPONSE/,
    )
  }

  for (const changes of [
    { cnpj: 123 },
    { endereco: null },
    { uf: true },
    { emailGestor: [] },
  ]) {
    assert.throws(
      () => normalizeAcademyProfileResult({
        ...validResponse(),
        academy: { ...validResponse().academy, ...changes },
      }, 'academy-dev'),
      /INVALID_ACADEMY_PROFILE_RESPONSE/,
    )
  }
})

test('resposta de outra academia e contexto invalido bloqueiam', () => {
  assert.throws(
    () => normalizeAcademyProfileResult(
      validResponse(),
      'outra-academia',
    ),
    /ACADEMY_PROFILE_CONTEXT_MISMATCH/,
  )

  for (const academyId of ['', '.', '..', 'academias/academy-dev']) {
    assert.throws(
      () => normalizeAcademyProfileResult(
        validResponse(),
        academyId,
      ),
      /INVALID_ACADEMY_PROFILE_CONTEXT/,
    )
  }
})

test('descarta identidade licencas e pagamento sem alterar original', () => {
  const response = {
    ...validResponse(),
    role: 'super_admin',
    academy: {
      ...validResponse().academy,
      ownerUid: 'gestor-dev',
      licencasTotais: 999,
      customerId: 'cliente-privado',
      metodoPagamentoId: 'pagamento-privado',
    },
  }

  const original = structuredClone(response)
  const result = normalizeAcademyProfileResult(
    response,
    'academy-dev',
  )

  assert.deepEqual(result, validResponse())
  assert.deepEqual(response, original)
})

test('valida atualizacao e confirmacao de dados ja existentes', () => {
  const changed = normalizeAcademyProfileUpdateResult({
    ...validResponse(),
    revision: 1,
    updated: true,
  }, 'academy-dev')

  assert.equal(changed.updated, true)
  assert.equal(changed.revision, 1)
  assert.equal(Object.isFrozen(changed), true)

  const unchanged = normalizeAcademyProfileUpdateResult({
    ...validResponse(),
    updated: false,
  }, 'academy-dev')

  assert.equal(unchanged.updated, false)
  assert.equal(unchanged.revision, 0)
})

test('atualizacao exige indicador booleano e revisao consistente', () => {
  for (const changes of [
    {},
    { updated: 'true', revision: 1 },
    { updated: true, revision: 0 },
  ]) {
    assert.throws(
      () => normalizeAcademyProfileUpdateResult({
        ...validResponse(),
        ...changes,
      }, 'academy-dev'),
      /INVALID_ACADEMY_PROFILE_UPDATE_RESPONSE/,
    )
  }
})