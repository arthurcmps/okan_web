import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademySubscriptionCancellation,
} from '../src/features/academies/academy-subscription-cancellation.ts'

import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'

import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

function setup() {
  const state = {
    session: { uid: 'manager-dev' } as MembershipSession | null,

    academy: {
      membershipId: `membership_${'a'.repeat(64)}`,
      schemaVersion: 1,
      academyId: 'academy-dev',
      userId: 'manager-dev',
      roles: ['gym_admin'],
      status: 'active',
      canManage: true,
    } as AcademyMembershipContext | null,

    calls: [] as unknown[],

    response: {
      academyId: 'academy-dev',
      status: 'canceled',
      providerStatus: 'canceled',
      alreadyCanceled: false,
    } as unknown,

    afterRequest: () => {},
  }

  const cancel = createAcademySubscriptionCancellation({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,

    request: async (payload) => {
      state.calls.push(payload)
      state.afterRequest()
      return state.response
    },
  })

  return { state, cancel }
}

test('cancelamento envia somente academia e descarta campos privados', async () => {
  const { state, cancel } = setup()

  state.response = {
    ...(state.response as object),
    providerSubscriptionId: 'private',
  }

  const result = await cancel('academy-dev', 'manager-dev')

  assert.deepEqual(state.calls, [{ academyId: 'academy-dev' }])
  assert.equal(result.status, 'canceled')
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.hasOwn(result, 'providerSubscriptionId'), false)
})

test('cancelamento repetido aceita confirmacao do servidor', async () => {
  const { state, cancel } = setup()

  state.response = {
    ...(state.response as object),
    alreadyCanceled: true,
  }

  const result = await cancel('academy-dev', 'manager-dev')
  assert.equal(result.alreadyCanceled, true)
})

test('sessao ausente divergente e vinculo suspenso bloqueiam envio', async () => {
  for (const failure of ['absent', 'different', 'suspended']) {
    const { state, cancel } = setup()

    if (failure === 'absent') state.session = null
    if (failure === 'different') state.session = { uid: 'other-user' }

    if (failure === 'suspended') {
      state.academy = {
        ...state.academy!,
        status: 'suspended',
        canManage: false,
      }
    }

    await assert.rejects(
      cancel('academy-dev', 'manager-dev'),
      /AUTHENTICATION_REQUIRED|AUTHENTICATION_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('mudanca de sessao ou academia descarta resposta', async () => {
  for (const change of ['session', 'academy']) {
    const { state, cancel } = setup()

    state.afterRequest = () => {
      if (change === 'session') {
        state.session = { uid: 'manager-dev' }
      } else {
        state.academy = { ...state.academy! }
      }
    }

    await assert.rejects(
      cancel('academy-dev', 'manager-dev'),
      /AUTHENTICATION_CHANGED|ACADEMY_CONTEXT_CHANGED/,
    )
  }
})

test('resposta de outra academia nao confirma cancelamento', async () => {
  const { state, cancel } = setup()

  state.response = {
    ...(state.response as object),
    academyId: 'other-academy',
  }

  await assert.rejects(
    cancel('academy-dev', 'manager-dev'),
    /ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH/,
  )
})

test('respostas incompletas ou sem reconciliacao nao confirmam sucesso', async () => {
  for (const response of [
    null,
    [],
    {},
    {
      academyId: 'academy-dev',
      status: 'active',
      providerStatus: 'canceled',
      alreadyCanceled: false,
    },
    {
      academyId: 'academy-dev',
      status: 'canceled',
      providerStatus: 'authorized',
      alreadyCanceled: false,
    },
    {
      academyId: 'academy-dev',
      status: 'canceled',
      providerStatus: 'canceled',
      alreadyCanceled: 'false',
    },
  ]) {
    const { state, cancel } = setup()
    state.response = response

    await assert.rejects(
      cancel('academy-dev', 'manager-dev'),
      /INVALID_ACADEMY_SUBSCRIPTION_RESPONSE|ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH/,
    )
  }
})

test('falha nao repete automaticamente uma mutacao', async () => {
  const { state, cancel } = setup()

  state.afterRequest = () => {
    throw new Error('BACKEND_UNAVAILABLE')
  }

  await assert.rejects(
    cancel('academy-dev', 'manager-dev'),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(state.calls.length, 1)
})

test('identificador invalido nao chega ao backend', async () => {
  const { state, cancel } = setup()

  await assert.rejects(
    cancel('invalid/id', 'manager-dev'),
    /INVALID_MEMBERSHIP_CONTEXT/,
  )

  assert.deepEqual(state.calls, [])
})