import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyRegistrationInput,
} from '../src/features/academies/academy-registration-input.ts'

function validInput() {
  return {
    gymName: 'Academia de teste',
    adminName: 'Gestor de teste',
    cnpj: '12.345.678/0001-90',
    telefone: '(21) 99999-9999',
    cep: '25000-000',
    endereco: 'Rua de teste, 123',
    bairro: 'Centro',
    uf: 'RJ',
  }
}

test('normaliza textos e UF sem alterar os dados originais', () => {
  const input = {
    gymName: '  Academia de teste  ',
    adminName: '  Gestor de teste  ',
    cnpj: '  12.345.678/0001-90  ',
    telefone: '  (21) 99999-9999  ',
    cep: '  25000-000  ',
    endereco: '  Rua de teste, 123  ',
    bairro: '  Centro  ',
    uf: '  rj  ',
  }

  const original = { ...input }
  const result = normalizeAcademyRegistrationInput(input)

  assert.deepEqual(result, validInput())
  assert.deepEqual(input, original)
  assert.equal(Object.isFrozen(result), true)
})

test('rejeita entrada ausente ou de tipo incorreto', () => {
  for (const input of [
    undefined,
    null,
    false,
    123,
    'academia',
    [],
  ]) {
    assert.throws(
      () => normalizeAcademyRegistrationInput(input),
      /INVALID_ACADEMY_REGISTRATION_INPUT/,
    )
  }
})

test('todos os campos exigem texto preenchido', () => {
  for (const field of Object.keys(validInput())) {
    for (const value of [
      undefined,
      null,
      '',
      '   ',
      123,
      true,
      [],
      {},
    ]) {
      assert.throws(
        () => normalizeAcademyRegistrationInput({
          ...validInput(),
          [field]: value,
        }),
        /INVALID_ACADEMY_REGISTRATION_INPUT/,
      )
    }
  }
})

test('UF exige duas letras e aceita letras minusculas', () => {
  const result = normalizeAcademyRegistrationInput({
    ...validInput(),
    uf: 'sp',
  })

  assert.equal(result.uf, 'SP')

  for (const uf of ['R', 'RIO', '21', 'R1', 'R J']) {
    assert.throws(
      () => normalizeAcademyRegistrationInput({
        ...validInput(),
        uf,
      }),
      /INVALID_ACADEMY_REGISTRATION_INPUT/,
    )
  }
})

test('descarta credenciais identidade permissoes e licencas extras', () => {
  const input = {
    ...validInput(),
    email: 'gestor@teste.com',
    password: 'senha-de-teste',
    confirmPassword: 'senha-de-teste',
    userId: 'outro-usuario',
    academyId: 'outra-academia',
    role: 'super_admin',
    ownerUid: 'outro-usuario',
    licencasTotais: 999,
  }

  const original = { ...input }
  const result = normalizeAcademyRegistrationInput(input)

  assert.deepEqual(result, validInput())
  assert.deepEqual(input, original)
})