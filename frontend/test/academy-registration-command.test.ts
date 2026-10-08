import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyRegistrationCommand,
} from '../src/features/academies/academy-registration-command.ts'
import type {
  AcademyRegistrationDependencies,
  AcademyRegistrationSession,
} from '../src/features/academies/academy-registration-command.ts'

const membershipId = `membership_${'a'.repeat(64)}`

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
    email: 'gestor@teste.com',
    password: 'Senha123!',
    confirmPassword: 'Senha123!',
  }
}

function setup(
  overrides: Partial<AcademyRegistrationDependencies> = {},
) {
  const state = {
    session: null as AcademyRegistrationSession | null,
    calls: [] as string[],
    credentials: null as {
      email: string
      password: string
    } | null,
    registrationPayload: null as unknown,
    membershipPayload: null as unknown,
  }

  const command = createAcademyRegistrationCommand({
    getCurrentSession: () => state.session,

    createAccount: async (email, password) => {
      state.calls.push('account')
      state.credentials = { email, password }
      state.session = { uid: 'gestor-dev', email }

      return state.session
    },

    registerAcademy: async (payload) => {
      state.calls.push('registration')
      state.registrationPayload = payload

      return {
        academyId: 'academy-dev',
        alreadyRegistered: false,
      }
    },

    provisionMembership: async (payload) => {
      state.calls.push('membership')
      state.membershipPayload = payload

      return {
        academyId: 'academy-dev',
        membershipId,
        alreadyProvisioned: false,
      }
    },

    ...overrides,
  })

  return { state, command }
}

test('cria conta academia e vinculo com payloads separados', async () => {
  const { state, command } = setup()
  const result = await command({
    ...validInput(),
    email: '  GESTOR@TESTE.COM  ',
    role: 'super_admin',
    ownerUid: 'outro-usuario',
  })

  assert.deepEqual(state.calls, [
    'account',
    'registration',
    'membership',
  ])

  assert.deepEqual(state.credentials, {
    email: 'gestor@teste.com',
    password: 'Senha123!',
  })

  const {
    email,
    password,
    confirmPassword,
    ...expectedPayload
  } = validInput()

  assert.equal(email, 'gestor@teste.com')
  assert.equal(password, confirmPassword)
  assert.deepEqual(state.registrationPayload, expectedPayload)
  assert.deepEqual(state.membershipPayload, {
    academyId: 'academy-dev',
  })

  assert.deepEqual(result, {
    academyId: 'academy-dev',
    alreadyRegistered: false,
    membershipId,
  })

  assert.equal(Object.isFrozen(result), true)
})

test('reaproveita sessao do mesmo email sem criar outra conta', async () => {
  const { state, command } = setup()

  state.session = {
    uid: 'gestor-dev',
    email: 'gestor@teste.com',
  }

  await command(validInput())

  assert.deepEqual(state.calls, [
    'registration',
    'membership',
  ])
})

test('sessao de outro email bloqueia antes de qualquer chamada', async () => {
  const { state, command } = setup()

  state.session = {
    uid: 'outro-gestor',
    email: 'outro@teste.com',
  }

  await assert.rejects(
    command(validInput()),
    /ACADEMY_REGISTRATION_SESSION_MISMATCH/,
  )

  assert.deepEqual(state.calls, [])
})

test('credenciais invalidas bloqueiam antes de criar conta', async () => {
  const invalidCredentials = [
    { email: '' },
    { email: 'email-invalido' },
    { password: '12345', confirmPassword: '12345' },
    { password: 123456 },
    { confirmPassword: 'outra-senha' },
  ]

  for (const credentials of invalidCredentials) {
    const { state, command } = setup()

    await assert.rejects(
      command({ ...validInput(), ...credentials }),
      /INVALID_ACADEMY_REGISTRATION_CREDENTIALS/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('dados da academia invalidos nao criam conta', async () => {
  const { state, command } = setup()

  await assert.rejects(
    command({ ...validInput(), gymName: '' }),
    /INVALID_ACADEMY_REGISTRATION_INPUT/,
  )

  assert.deepEqual(state.calls, [])
})

test('falha de cadastro preserva sessao e permite retomar', async () => {
  let attempts = 0

  const { state, command } = setup({
    registerAcademy: async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error('NETWORK_FAILURE')
      }

      return {
        academyId: 'academy-dev',
        alreadyRegistered: true,
      }
    },
  })

  await assert.rejects(command(validInput()), /NETWORK_FAILURE/)

  assert.equal(state.session?.uid, 'gestor-dev')

  const result = await command(validInput())

  assert.equal(result.alreadyRegistered, true)
  assert.equal(attempts, 2)
  assert.equal(
    state.calls.filter((call) => call === 'account').length,
    1,
  )
})

test('falha de provisionamento permite retomar sem duplicar conta', async () => {
  let attempts = 0

  const { state, command } = setup({
    provisionMembership: async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error('MEMBERSHIP_FAILURE')
      }

      return {
        academyId: 'academy-dev',
        membershipId,
        alreadyProvisioned: true,
      }
    },
  })

  await assert.rejects(command(validInput()), /MEMBERSHIP_FAILURE/)

  await command(validInput())

  assert.equal(attempts, 2)
  assert.equal(
    state.calls.filter((call) => call === 'account').length,
    1,
  )
})

test('troca de sessao durante cadastro impede provisionamento', async () => {
  const { state, command } = setup({
    registerAcademy: async () => {
      state.session = null

      return {
        academyId: 'academy-dev',
        alreadyRegistered: false,
      }
    },
  })

  await assert.rejects(command(validInput()), /AUTHENTICATION_CHANGED/)

  assert.equal(state.calls.includes('membership'), false)
})

test('cadastro com resposta invalida impede provisionamento', async () => {
  const { state, command } = setup({
    registerAcademy: async () => ({
      academyId: 'academy-dev',
    }),
  })

  await assert.rejects(
    command(validInput()),
    /INVALID_ACADEMY_REGISTRATION_RESPONSE/,
  )

  assert.equal(state.calls.includes('membership'), false)
})

test('vinculo de outra academia nao confirma sucesso', async () => {
  const { command } = setup({
    provisionMembership: async () => ({
      academyId: 'outra-academia',
      membershipId,
      alreadyProvisioned: false,
    }),
  })

  await assert.rejects(
    command(validInput()),
    /INVALID_ACADEMY_REGISTRATION_MEMBERSHIP/,
  )
})

test('troca de sessao durante provisionamento descarta confirmacao', async () => {
  const { state, command } = setup({
    provisionMembership: async () => {
      state.session = {
        uid: 'outro-gestor',
        email: 'outro@teste.com',
      }

      return {
        academyId: 'academy-dev',
        membershipId,
        alreadyProvisioned: false,
      }
    },
  })

  await assert.rejects(command(validInput()), /AUTHENTICATION_CHANGED/)
})

test('bloqueia dois cadastros simultaneos no mesmo comando', async () => {
  let complete: (value: unknown) => void = () => {
    throw new Error('REGISTRATION_NOT_STARTED')
  }

  const { command } = setup({
    registerAcademy: () => new Promise<unknown>((resolve) => {
      complete = resolve
    }),
  })

  const first = command(validInput())

  try {
    await assert.rejects(
      command(validInput()),
      /ACADEMY_REGISTRATION_IN_PROGRESS/,
    )
  } finally {
    complete({
      academyId: 'academy-dev',
      alreadyRegistered: false,
    })
  }

  await first
})