import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademySubscriptionStart,
} from '../src/features/academies/academy-subscription-start.ts'

import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'

import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const attemptId = '550e8400-e29b-41d4-a716-446655440000'

const input = {
  attemptId,
  cardTokenId: 'mock-card-token',

  quote: {
    schemaVersion: 1 as const,
    academyId: 'academy-dev',
    academyName: 'Academia',
    licenseQuantity: 3,
    currentLicensesUsed: 1,
    unitMonthlyAmount: 45,
    monthlyAmount: 135,
    currency: 'BRL' as const,
    billingDay: 10,
  },
}

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
      attemptId,
      licenseQuantity: 3,
      monthlyAmount: 135,
      currency: 'BRL',
      billingDay: 10,
      providerStatus: 'authorized',
      recovered: false,
      alreadyCompleted: false,
    } as unknown,

    afterRequest: async () => {},
  }

  const start = createAcademySubscriptionStart({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,

    request: async (payload) => {
      state.calls.push(payload)
      await state.afterRequest()
      return state.response
    },
  })

  return { state, start }
}

test('contratacao envia somente os campos da chamada publica', async () => {
  const { state, start } = setup()

  state.response = {
    ...(state.response as object),
    providerSubscriptionId: 'private',
  }

  const result = await start('academy-dev', 'manager-dev', input)

  assert.deepEqual(state.calls, [{
    academyId: 'academy-dev',
    quantidadeLicencas: 3,
    diaCobranca: 10,
    attemptId,
    cardTokenId: 'mock-card-token',
  }])

  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.hasOwn(result, 'providerSubscriptionId'), false)
  assert.equal(Object.hasOwn(result, 'cardTokenId'), false)
  assert.equal(Object.hasOwn(result, 'accessAllowed'), false)
})

test('repeticao finalizada aceita status nulo sem inventar pagamento', async () => {
  const { state, start } = setup()

  state.response = {
    ...(state.response as object),
    providerStatus: null,
    alreadyCompleted: true,
  }

  const result = await start('academy-dev', 'manager-dev', input)

  assert.equal(result.alreadyCompleted, true)
  assert.equal(result.providerStatus, null)
})

test('contextos nao autorizados nao chamam backend', async () => {
  for (const failure of ['session', 'user', 'academy', 'suspended']) {
    const { state, start } = setup()

    if (failure === 'session') state.session = null
    if (failure === 'user') state.session = { uid: 'other-user' }
    if (failure === 'academy') state.academy = null

    if (failure === 'suspended') {
      state.academy = {
        ...state.academy!,
        status: 'suspended',
        canManage: false,
      }
    }

    await assert.rejects(
      start('academy-dev', 'manager-dev', input),
      /AUTHENTICATION_REQUIRED|AUTHENTICATION_CHANGED|ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('tentativa token e cotacao invalidos nao chamam backend', async () => {
  const { state, start } = setup()

  for (const changes of [
    { attemptId: 'invalid' },
    { cardTokenId: '' },
    { quote: { ...input.quote, monthlyAmount: 134 } },
  ]) {
    await assert.rejects(
      start('academy-dev', 'manager-dev', { ...input, ...changes }),
      /INVALID_SUBSCRIPTION_ATTEMPT_ID|INVALID_CARD_TOKEN_ID|INVALID_ACADEMY_SUBSCRIPTION_RESPONSE/,
    )
  }

  assert.deepEqual(state.calls, [])
})

test('troca de contexto descarta resposta', async () => {
  for (const change of ['session', 'academy']) {
    const { state, start } = setup()

    state.afterRequest = async () => {
      if (change === 'session') {
        state.session = { uid: 'manager-dev' }
      } else {
        state.academy = { ...state.academy! }
      }
    }

    await assert.rejects(
      start('academy-dev', 'manager-dev', input),
      /AUTHENTICATION_CHANGED|ACADEMY_CONTEXT_CHANGED/,
    )
  }
})

test('outra academia ou tentativa nao confirma contratacao', async () => {
  for (const changes of [
    { academyId: 'other' },
    { attemptId: 'other' },
  ]) {
    const { state, start } = setup()

    state.response = {
      ...(state.response as object),
      ...changes,
    }

    await assert.rejects(
      start('academy-dev', 'manager-dev', input),
      /ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH/,
    )
  }
})

test('valor moeda quantidade dia e status divergentes nao confirmam sucesso', async () => {
  for (const changes of [
    { monthlyAmount: 140 },
    { currency: 'USD' },
    { licenseQuantity: 4 },
    { billingDay: 11 },
    { providerStatus: 'paid' },
    { recovered: 'false' },
    { alreadyCompleted: null },
  ]) {
    const { state, start } = setup()

    state.response = {
      ...(state.response as object),
      ...changes,
    }

    await assert.rejects(
      start('academy-dev', 'manager-dev', input),
      /INVALID_ACADEMY_SUBSCRIPTION_RESPONSE/,
    )
  }
})

test('falha nao repete envio e nova chamada preserva tentativa com token novo', async () => {
  const { state, start } = setup()

  state.afterRequest = async () => {
    throw new Error('TIMEOUT')
  }

  await assert.rejects(
    start('academy-dev', 'manager-dev', input),
    /TIMEOUT/,
  )

  assert.equal(state.calls.length, 1)

  state.afterRequest = async () => {}

  await start('academy-dev', 'manager-dev', {
    ...input,
    cardTokenId: 'new-token',
  })

  assert.equal(
    (state.calls[1] as { attemptId: string }).attemptId,
    attemptId,
  )
})

test('duplo envio simultaneo e bloqueado', async () => {
  const { state, start } = setup()

  let release: () => void = () => {}

  state.afterRequest = () => new Promise<void>((resolve) => {
    release = resolve
  })

  const first = start('academy-dev', 'manager-dev', input)

  await assert.rejects(
    start('academy-dev', 'manager-dev', input),
    /ACADEMY_SUBSCRIPTION_IN_PROGRESS/,
  )

  assert.equal(state.calls.length, 1)

  release()
  await first
})