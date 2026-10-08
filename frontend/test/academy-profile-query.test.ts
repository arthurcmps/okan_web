import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyProfileQuery,
} from '../src/features/academies/academy-profile-query.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

function validAcademy(): AcademyMembershipContext {
  return {
    membershipId: `membership_${'a'.repeat(64)}`,
    schemaVersion: 1,
    academyId: 'academy-dev',
    userId: 'manager-dev',
    roles: ['gym_admin'],
    status: 'active',
    canManage: true,
  }
}

function validResponse() {
  return {
    academy: {
      academyId: 'academy-dev',
      nome: 'Academia de teste',
      cnpj: '',
      telefoneResponsavel: '',
      cep: '',
      endereco: '',
      bairro: '',
      uf: '',
      emailGestor: 'gestor@teste.com',
    },
    revision: 0,
  }
}

function setup() {
  const state = {
    session: { uid: 'manager-dev' } as MembershipSession | null,
    academy: validAcademy() as AcademyMembershipContext | null,
    calls: [] as unknown[],
  }

  const query = createAcademyProfileQuery({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,

    requestProfile: async (payload) => {
      state.calls.push(payload)
      return validResponse()
    },
  })

  return { state, query }
}

test('envia somente academia e valida cadastro e revisao', async () => {
  const { state, query } = setup()

  const result = await query('academy-dev', 'manager-dev')

  assert.deepEqual(state.calls, [{ academyId: 'academy-dev' }])
  assert.deepEqual(result, validResponse())
})

test('sessao ausente ou diferente bloqueia antes da chamada', async () => {
  for (const session of [null, { uid: 'other-manager' }]) {
    const { state, query } = setup()
    state.session = session

    await assert.rejects(
      query('academy-dev', 'manager-dev'),
      /AUTHENTICATION_REQUIRED|AUTHENTICATION_CHANGED/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('academia ausente diferente ou sem permissao bloqueia', async () => {
  const invalidAcademies: Array<AcademyMembershipContext | null> = [
    null,
    { ...validAcademy(), academyId: 'other-academy' },
    { ...validAcademy(), userId: 'other-manager' },
    { ...validAcademy(), status: 'suspended', canManage: false },
    { ...validAcademy(), roles: ['aluno'], canManage: false },
    { ...validAcademy(), canManage: false },
  ]

  for (const academy of invalidAcademies) {
    const { state, query } = setup()
    state.academy = academy

    await assert.rejects(
      query('academy-dev', 'manager-dev'),
      /ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('identificadores invalidos nao chamam backend', async () => {
  for (const [academyId, userId] of [
    ['', 'manager-dev'],
    ['academias/academy-dev', 'manager-dev'],
    ['academy-dev', ''],
    ['academy-dev', 'users/manager-dev'],
  ]) {
    const { state, query } = setup()

    await assert.rejects(
      query(academyId, userId),
      /INVALID_ACADEMY_ID|INVALID_MEMBERSHIP_CONTEXT/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('troca de sessao durante consulta descarta resultado', async () => {
  let session: MembershipSession | null = { uid: 'manager-dev' }
  const academy = validAcademy()

  const query = createAcademyProfileQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,

    requestProfile: async () => {
      session = { uid: 'other-manager' }
      return validResponse()
    },
  })

  await assert.rejects(
    query('academy-dev', 'manager-dev'),
    /AUTHENTICATION_CHANGED/,
  )
})

test('troca de academia durante consulta descarta resultado', async () => {
  const session: MembershipSession = { uid: 'manager-dev' }
  let academy = validAcademy()

  const query = createAcademyProfileQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,

    requestProfile: async () => {
      academy = { ...validAcademy(), academyId: 'other-academy' }
      return validResponse()
    },
  })

  await assert.rejects(
    query('academy-dev', 'manager-dev'),
    /ACADEMY_CONTEXT_CHANGED/,
  )
})

test('resposta invalida ou de outra academia e rejeitada', async () => {
  for (const response of [
    {},
    { ...validResponse(), revision: -1 },
    {
      ...validResponse(),
      academy: {
        ...validResponse().academy,
        academyId: 'other-academy',
      },
    },
  ]) {
    const query = createAcademyProfileQuery({
      getCurrentSession: () => session,
      getCurrentAcademy: () => academy,
      requestProfile: async () => response,
    })

    const session: MembershipSession = { uid: 'manager-dev' }
    const academy = validAcademy()

    await assert.rejects(
      query('academy-dev', 'manager-dev'),
      /INVALID_ACADEMY_PROFILE_RESPONSE|ACADEMY_PROFILE_CONTEXT_MISMATCH/,
    )
  }
})

test('falha do backend e propagada sem repetir consulta', async () => {
  const session: MembershipSession = { uid: 'manager-dev' }
  const academy = validAcademy()
  let calls = 0

  const query = createAcademyProfileQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,

    requestProfile: async () => {
      calls += 1
      throw new Error('BACKEND_UNAVAILABLE')
    },
  })

  await assert.rejects(
    query('academy-dev', 'manager-dev'),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(calls, 1)
})