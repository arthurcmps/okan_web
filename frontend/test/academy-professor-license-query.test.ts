import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyProfessorLicensePage,
} from '../src/features/academies/academy-professor-license-result.ts'
import {
  createAcademyProfessorLicenseQuery,
} from '../src/features/academies/academy-professor-license-query.ts'
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

function validResponse(count = 1) {
  return {
    academyId: 'academy-dev',
    licensesTotal: 50,
    licensesUsed: count,
    licensesAvailable: 50 - count,
    licenses: Array.from({ length: count }, (_, index) => ({
      academyId: 'academy-dev',
      licenseId: `license-${String(index).padStart(3, '0')}`,
      email: `professor${index}@teste.com`,
      status: 'Pendente',
    })),
    nextCursor: null as string | null,
  }
}

function setup() {
  const state = {
    session: { uid: 'manager-dev' } as MembershipSession | null,
    academy: validAcademy() as AcademyMembershipContext | null,
    response: validResponse() as unknown,
    calls: [] as unknown[],
  }

  const query = createAcademyProfessorLicenseQuery({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,
    requestLicenses: async (payload) => {
      state.calls.push(payload)
      return state.response
    },
  })

  return { state, query }
}

test('valida capacidade e congela pagina e licencas', () => {
  const result = normalizeAcademyProfessorLicensePage(
    validResponse(),
    'academy-dev',
  )

  assert.deepEqual(result, validResponse())
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.licenses), true)
  assert.equal(Object.isFrozen(result.licenses[0]), true)
})

test('descarta campos privados sem alterar resposta original', () => {
  const response = {
    ...validResponse(),
    providerCustomerId: 'private-customer',
    licenses: [{
      ...validResponse().licenses[0]!,
      userId: 'private-user',
      isPremium: true,
    }],
  }
  const original = structuredClone(response)

  const result = normalizeAcademyProfessorLicensePage(
    response,
    'academy-dev',
  )

  assert.deepEqual(result, validResponse())
  assert.deepEqual(response, original)
})

test('rejeita capacidade pagina e documentos inconsistentes', () => {
  for (const response of [
    null,
    {},
    { ...validResponse(), licensesTotal: '50' },
    { ...validResponse(), licensesUsed: -1 },
    { ...validResponse(), licensesUsed: 51 },
    { ...validResponse(), licensesAvailable: 0 },
    { ...validResponse(), licenses: null },
    validResponse(21),
    { ...validResponse(), nextCursor: 'license-000' },
    {
      ...validResponse(),
      licenses: [{ ...validResponse().licenses[0]!, email: 'invalid' }],
    },
    {
      ...validResponse(),
      licenses: [{ ...validResponse().licenses[0]!, status: '' }],
    },
    {
      ...validResponse(),
      licenses: [{
        ...validResponse().licenses[0]!,
        academyId: 'other-academy',
      }],
    },
    {
      ...validResponse(),
      licenses: [
        validResponse().licenses[0]!,
        validResponse().licenses[0]!,
      ],
    },
    {
      ...validResponse(2),
      licenses: [...validResponse(2).licenses].reverse(),
    },
  ]) {
    assert.throws(
      () => normalizeAcademyProfessorLicensePage(response, 'academy-dev'),
      /INVALID_PROFESSOR_LICENSE_RESPONSE|PROFESSOR_LICENSE_CONTEXT_MISMATCH/,
    )
  }
})

test('pagina cheia exige cursor correspondente ao ultimo item', () => {
  const response = validResponse(20)
  response.nextCursor = response.licenses[19]!.licenseId

  const result = normalizeAcademyProfessorLicensePage(
    response,
    'academy-dev',
  )

  assert.equal(result.nextCursor, 'license-019')

  assert.throws(
    () => normalizeAcademyProfessorLicensePage({
      ...response,
      nextCursor: 'license-018',
    }, 'academy-dev'),
    /INVALID_PROFESSOR_LICENSE_RESPONSE/,
  )

  assert.deepEqual(
    normalizeAcademyProfessorLicensePage(validResponse(0), 'academy-dev'),
    validResponse(0),
  )
})

test('consulta envia somente academia e cursor', async () => {
  const { state, query } = setup()

  const result = await query('academy-dev', 'manager-dev')

  assert.deepEqual(state.calls, [{
    academyId: 'academy-dev',
    cursor: null,
  }])
  assert.deepEqual(result, validResponse())
})

test('sessao e academia invalidas bloqueiam antes da chamada', async () => {
  const invalidStates: Array<{
    session?: MembershipSession | null
    academy?: AcademyMembershipContext | null
  }> = [
    { session: null },
    { session: { uid: 'other-manager' } },
    { academy: null },
    { academy: { ...validAcademy(), academyId: 'other-academy' } },
    { academy: { ...validAcademy(), userId: 'other-manager' } },
    {
      academy: {
        ...validAcademy(),
        status: 'suspended',
        canManage: false,
      },
    },
    { academy: { ...validAcademy(), roles: ['aluno'] } },
    { academy: { ...validAcademy(), canManage: false } },
  ]

  for (const invalid of invalidStates) {
    const { state, query } = setup()
    Object.assign(state, invalid)

    await assert.rejects(
      query('academy-dev', 'manager-dev'),
      /AUTHENTICATION_|ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('identificadores e cursor invalidos nao chamam backend', async () => {
  for (const [academyId, userId, cursor] of [
    ['', 'manager-dev', null],
    ['invalid/id', 'manager-dev', null],
    ['academy-dev', '', null],
    ['academy-dev', 'manager-dev', 'invalid/id'],
    ['academy-dev', 'manager-dev', ''],
  ] as const) {
    const { state, query } = setup()

    await assert.rejects(
      query(academyId, userId, cursor),
      /INVALID_/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('troca de sessao ou academia durante consulta descarta resposta',
  async () => {
    for (const change of ['session', 'academy']) {
      const state = {
        session: { uid: 'manager-dev' } as MembershipSession | null,
        academy: validAcademy(),
      }

      const query = createAcademyProfessorLicenseQuery({
        getCurrentSession: () => state.session,
        getCurrentAcademy: () => state.academy,
        requestLicenses: async () => {
          if (change === 'session') {
            state.session = { uid: 'manager-dev' }
          } else {
            state.academy = { ...validAcademy() }
          }

          return validResponse()
        },
      })

      await assert.rejects(
        query('academy-dev', 'manager-dev'),
        /AUTHENTICATION_CHANGED|ACADEMY_CONTEXT_CHANGED/,
      )
    }
  })

test('resposta de outra academia nao confirma consulta', async () => {
  const { state, query } = setup()

  state.response = { ...validResponse(), academyId: 'other-academy' }

  await assert.rejects(
    query('academy-dev', 'manager-dev'),
    /PROFESSOR_LICENSE_CONTEXT_MISMATCH/,
  )
})

test('paginacao envia cursor e rejeita repeticao de pagina', async () => {
  const { state, query } = setup()

  await query('academy-dev', 'manager-dev', 'license-')

  assert.deepEqual(state.calls, [{
    academyId: 'academy-dev',
    cursor: 'license-',
  }])

  await assert.rejects(
    query('academy-dev', 'manager-dev', 'license-000'),
    /INVALID_PROFESSOR_LICENSE_RESPONSE/,
  )
})

test('falha do backend nao repete consulta automaticamente', async () => {
  const session: MembershipSession = { uid: 'manager-dev' }
  const academy = validAcademy()
  let calls = 0

  const query = createAcademyProfessorLicenseQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestLicenses: async () => {
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
