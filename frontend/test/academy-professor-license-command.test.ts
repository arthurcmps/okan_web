import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyProfessorLicenseCommands,
} from '../src/features/academies/academy-professor-license-command.ts'
import type {
  AcademyLicenseOperation,
} from '../src/features/academies/academy-professor-license-command.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const licenseId = `email_${'a'.repeat(64)}`

function validAcademy(): AcademyMembershipContext {
  return {
    membershipId: `membership_${'b'.repeat(64)}`,
    schemaVersion: 1,
    academyId: 'academy-dev',
    userId: 'manager-dev',
    roles: ['gym_admin'],
    status: 'active',
    canManage: true,
  }
}

function grantResponse() {
  return {
    academyId: 'academy-dev',
    licenseId,
    licensesTotal: 3,
    licensesUsed: 1,
    alreadyGranted: false,
  }
}

function setup() {
  const state = {
    session: { uid: 'manager-dev' } as MembershipSession | null,
    academy: validAcademy() as AcademyMembershipContext | null,
    calls: [] as AcademyLicenseOperation[],
    response: grantResponse() as unknown,
    failure: null as Error | null,
  }

  const commands = createAcademyProfessorLicenseCommands({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,
    requestOperation: async (operation) => {
      state.calls.push(operation)
      if (state.failure) throw state.failure
      return state.response
    },
  })

  return { state, commands }
}

test('concessao normaliza email e envia somente academia e email', async () => {
  const { state, commands } = setup()

  const result = await commands.grantLicense(
    'academy-dev', 'manager-dev', ' Professor@Teste.com ',
  )

  assert.deepEqual(state.calls, [{
    kind: 'grant',
    payload: {
      academyId: 'academy-dev',
      professorEmail: 'professor@teste.com',
    },
  }])

  assert.equal(result.alreadyProcessed, false)
  assert.equal(result.licensesUsed, 1)
  assert.equal(Object.isFrozen(result), true)
})

test('remocao valida ID e aceita confirmacao repetida', async () => {
  for (const alreadyRemoved of [false, true]) {
    const { state, commands } = setup()

    state.response = {
      academyId: 'academy-dev',
      licenseId: 'legacy-license',
      licensesTotal: 3,
      licensesUsed: 0,
      alreadyRemoved,
    }

    const result = await commands.revokeLicense(
      'academy-dev', 'manager-dev', 'legacy-license',
    )

    assert.deepEqual(state.calls, [{
      kind: 'revoke',
      payload: {
        academyId: 'academy-dev',
        licenseId: 'legacy-license',
      },
    }])
    assert.equal(result.alreadyProcessed, alreadyRemoved)
  }
})

test('sessao e permissao invalidas bloqueiam ambas operacoes', async () => {
  const invalidStates = [
    { session: null },
    { session: { uid: 'other-manager' } },
    { academy: null },
    { academy: { ...validAcademy(), academyId: 'other-academy' } },
    { academy: { ...validAcademy(), userId: 'other-manager' } },
    {
      academy: {
        ...validAcademy(),
        status: 'suspended' as const,
        canManage: false,
      },
    },
    {
      academy: {
        ...validAcademy(),
        roles: ['aluno'] as const,
        canManage: false,
      },
    },
  ]

  for (const invalid of invalidStates) {
    const { state, commands } = setup()
    Object.assign(state, invalid)

    await assert.rejects(
      async () => commands.grantLicense(
        'academy-dev', 'manager-dev', 'professor@teste.com',
      ),
      /AUTHENTICATION_|ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    await assert.rejects(
      async () => commands.revokeLicense(
        'academy-dev', 'manager-dev', licenseId,
      ),
      /AUTHENTICATION_|ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.equal(state.calls.length, 0)
  }
})

test('emails e identificadores invalidos nao chegam ao backend', async () => {
  const { state, commands } = setup()

  for (const email of ['', '@teste.com', 'a@@teste.com', 'a b@teste.com', 123]) {
    await assert.rejects(
      async () => commands.grantLicense('academy-dev', 'manager-dev', email),
      /INVALID_PROFESSOR_EMAIL/,
    )
  }

  await assert.rejects(
    async () => commands.revokeLicense('academy-dev', 'manager-dev', 'a/b'),
    /INVALID_PROFESSOR_LICENSE_ID/,
  )
  await assert.rejects(
    async () => commands.grantLicense('a/b', 'manager-dev', 'a@teste.com'),
    /INVALID_ACADEMY_ID/,
  )

  assert.equal(state.calls.length, 0)
})

test('respostas inconsistentes nao confirmam concessao', async () => {
  for (const response of [
    null,
    {},
    { ...grantResponse(), academyId: 'other-academy' },
    { ...grantResponse(), licenseId: 'invalid-license' },
    { ...grantResponse(), licensesUsed: -1 },
    { ...grantResponse(), licensesUsed: 4 },
    { ...grantResponse(), licensesUsed: 0 },
    { ...grantResponse(), licensesTotal: '3' },
    { ...grantResponse(), alreadyGranted: 'false' },
  ]) {
    const { state, commands } = setup()
    state.response = response

    await assert.rejects(
      commands.grantLicense('academy-dev', 'manager-dev', 'a@teste.com'),
      /INVALID_LICENSE_MUTATION_RESPONSE/,
    )

    assert.equal(state.calls.length, 1)
  }
})

test('confirmacao de remocao deve corresponder a licenca solicitada',
  async () => {
    const { state, commands } = setup()
    state.response = {
      academyId: 'academy-dev',
      licenseId: 'other-license',
      licensesTotal: 3,
      licensesUsed: 0,
      alreadyRemoved: false,
    }

    await assert.rejects(
      commands.revokeLicense('academy-dev', 'manager-dev', licenseId),
      /INVALID_LICENSE_MUTATION_RESPONSE/,
    )
  })

test('campos privados sao descartados sem alterar resposta', async () => {
  const { state, commands } = setup()
  const response = {
    ...grantResponse(),
    userId: 'private-user',
    isPremium: true,
    providerPaymentId: 'private-payment',
  }
  state.response = response

  const result = await commands.grantLicense(
    'academy-dev', 'manager-dev', 'a@teste.com',
  )

  assert.deepEqual(Object.keys(result).sort(), [
    'academyId',
    'alreadyProcessed',
    'licenseId',
    'licensesTotal',
    'licensesUsed',
  ])
  assert.equal(response.isPremium, true)
})

test('troca de sessao ou academia descarta confirmacao', async () => {
  for (const change of ['session', 'academy']) {
    let session: MembershipSession = { uid: 'manager-dev' }
    let academy = validAcademy()

    const commands = createAcademyProfessorLicenseCommands({
      getCurrentSession: () => session,
      getCurrentAcademy: () => academy,
      requestOperation: async () => {
        if (change === 'session') {
          session = { uid: 'manager-dev' }
        } else {
          academy = { ...validAcademy() }
        }
        return grantResponse()
      },
    })

    await assert.rejects(
      commands.grantLicense('academy-dev', 'manager-dev', 'a@teste.com'),
      /AUTHENTICATION_CHANGED|ACADEMY_CONTEXT_CHANGED/,
    )
  }
})

test('falha do backend nao repete operacao automaticamente', async () => {
  const { state, commands } = setup()
  state.failure = new Error('BACKEND_UNAVAILABLE')

  await assert.rejects(
    commands.grantLicense('academy-dev', 'manager-dev', 'a@teste.com'),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(state.calls.length, 1)
})