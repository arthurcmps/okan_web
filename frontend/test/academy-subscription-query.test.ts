import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademySubscriptionPanel,
  normalizeAcademySubscriptionQuote,
} from '../src/features/academies/academy-subscription-result.ts'
import {
  createAcademySubscriptionQueries,
} from '../src/features/academies/academy-subscription-query.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

function membership(): AcademyMembershipContext {
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

function panel() {
  return {
    academyId: 'academy-dev',
    academyName: 'Academia de teste',
    licensesTotal: 3,
    licensesUsed: 1,
    licensesAvailable: 2,
    subscription: null,
    legacyBilling: {
      detected: false,
      requiresMigration: false,
      status: null,
    },
  }
}

function subscription() {
  return {
    status: 'active',
    billingStatus: 'processing',
    licenseQuantity: 3,
    monthlyAmount: 135,
    currency: 'BRL',
    billingDay: 10,
    billingDebitDate: null,
    accessAllowed: false,
    accessGrace: false,
    accessReason: 'awaiting_first_payment',
  }
}

function quote() {
  return {
    schemaVersion: 1,
    academyId: 'academy-dev',
    academyName: 'Academia de teste',
    licenseQuantity: 3,
    currentLicensesUsed: 1,
    unitMonthlyAmount: 45,
    monthlyAmount: 135,
    currency: 'BRL',
    billingDay: 10,
  }
}

function setup() {
  const state = {
    session: { uid: 'manager-dev' } as MembershipSession | null,
    academy: membership() as AcademyMembershipContext | null,
    calls: [] as unknown[],
    response: panel() as unknown,
    afterRequest: () => {},
  }

  const queries = createAcademySubscriptionQueries({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,
    request: async (payload) => {
      state.calls.push(payload)
      state.afterRequest()
      return state.response
    },
  })

  return { state, queries }
}

test('capacidade sem assinatura nao inventa pagamento', () => {
  const result = normalizeAcademySubscriptionPanel(panel(), 'academy-dev')

  assert.equal(result.subscription, null)
  assert.equal(result.licensesAvailable, 2)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.legacyBilling), true)
})

test('descarta campos privados sem alterar resposta original', () => {
  const original = {
    ...panel(),
    ownerUid: 'private-owner',
    subscription: {
      ...subscription(),
      providerSubscriptionId: 'private-subscription',
    },
  }

  const result = normalizeAcademySubscriptionPanel(original, 'academy-dev')

  assert.equal(Object.hasOwn(result, 'ownerUid'), false)
  assert.equal(
    Object.hasOwn(result.subscription!, 'providerSubscriptionId'),
    false,
  )
  assert.equal(Object.isFrozen(result.subscription), true)
  assert.equal(
    original.subscription.providerSubscriptionId,
    'private-subscription',
  )
})

test('autorizacao sem primeiro pagamento continua sem acesso', () => {
  const result = normalizeAcademySubscriptionPanel({
    ...panel(),
    subscription: subscription(),
  }, 'academy-dev')

  assert.equal(result.subscription?.accessAllowed, false)

  assert.throws(() => normalizeAcademySubscriptionPanel({
    ...panel(),
    subscription: { ...subscription(), accessAllowed: true },
  }, 'academy-dev'), /INVALID_ACADEMY_SUBSCRIPTION_RESPONSE/)
})

test('rejeita capacidade estados datas e migracao inconsistentes', () => {
  for (const value of [
    {},
    { ...panel(), licensesUsed: 4 },
    { ...panel(), licensesAvailable: 3 },
    { ...panel(), licensesTotal: '3' },
    {
      ...panel(),
      legacyBilling: {
        detected: false,
        requiresMigration: true,
        status: null,
      },
    },
    {
      ...panel(),
      subscription: { ...subscription(), status: 'unknown' },
    },
    {
      ...panel(),
      subscription: { ...subscription(), billingDebitDate: 'invalid' },
    },
    {
      ...panel(),
      subscription: { ...subscription(), monthlyAmount: 135.001 },
    },
  ]) {
    assert.throws(
      () => normalizeAcademySubscriptionPanel(value, 'academy-dev'),
      /INVALID_ACADEMY_SUBSCRIPTION_RESPONSE/,
    )
  }
})

test('cotacao valida quantidade dia e total sem fixar preco no cliente', () => {
  const result = normalizeAcademySubscriptionQuote({
    ...quote(),
    unitMonthlyAmount: 50,
    monthlyAmount: 150,
  }, 'academy-dev', 3, 10)

  assert.equal(result.monthlyAmount, 150)
  assert.equal(Object.isFrozen(result), true)

  for (const changes of [
    { licenseQuantity: 4 },
    { billingDay: 11 },
    { monthlyAmount: 134 },
    { currentLicensesUsed: 4 },
    { currency: 'USD' },
  ]) {
    assert.throws(
      () => normalizeAcademySubscriptionQuote({
        ...quote(),
        ...changes,
      }, 'academy-dev', 3, 10),
      /INVALID_ACADEMY_SUBSCRIPTION_RESPONSE/,
    )
  }
})

test('consulta e cotacao enviam somente os campos permitidos', async () => {
  const { state, queries } = setup()

  await queries.getPanel('academy-dev', 'manager-dev')
  state.response = quote()
  await queries.quote('academy-dev', 'manager-dev', 3, 10)

  assert.deepEqual(state.calls, [
    { academyId: 'academy-dev' },
    { academyId: 'academy-dev', licenseQuantity: 3, billingDay: 10 },
  ])
})

test('sessao ausente e gestor suspenso bloqueiam ambas consultas', async () => {
  for (const operation of ['get', 'quote']) {
    for (const failure of ['session', 'membership']) {
      const { state, queries } = setup()

      if (failure === 'session') {
        state.session = null
      } else {
        state.academy = {
          ...membership(),
          status: 'suspended',
          canManage: false,
        }
      }

      await assert.rejects(
        operation === 'get'
          ? queries.getPanel('academy-dev', 'manager-dev')
          : queries.quote('academy-dev', 'manager-dev', 3, 10),
        /AUTHENTICATION_REQUIRED|ACADEMY_MANAGEMENT_FORBIDDEN/,
      )
      assert.deepEqual(state.calls, [])
    }
  }
})

test('troca de sessao ou academia descarta ambas respostas', async () => {
  for (const operation of ['get', 'quote']) {
    for (const change of ['session', 'academy']) {
      const { state, queries } = setup()
      state.response = operation === 'get' ? panel() : quote()

      state.afterRequest = () => {
        if (change === 'session') {
          state.session = { uid: 'manager-dev' }
        } else {
          state.academy = { ...membership() }
        }
      }

      await assert.rejects(
        operation === 'get'
          ? queries.getPanel('academy-dev', 'manager-dev')
          : queries.quote('academy-dev', 'manager-dev', 3, 10),
        /AUTHENTICATION_CHANGED|ACADEMY_CONTEXT_CHANGED/,
      )
    }
  }
})

test('quantidade dia e identificadores invalidos nao chegam ao backend',
  async () => {
    const { state, queries } = setup()

    for (const [quantity, day] of [[0, 10], [1.5, 10], [3, 29]]) {
      await assert.rejects(
        queries.quote('academy-dev', 'manager-dev', quantity, day),
        /INVALID_SUBSCRIPTION_QUOTE_INPUT/,
      )
    }

    await assert.rejects(
      queries.getPanel('invalid/id', 'manager-dev'),
      /INVALID_MEMBERSHIP_CONTEXT/,
    )

    assert.deepEqual(state.calls, [])
  })

test('resposta de outra academia e rejeitada', async () => {
  for (const operation of ['get', 'quote']) {
    const { state, queries } = setup()

    state.response = {
      ...(operation === 'get' ? panel() : quote()),
      academyId: 'other-academy',
    }

    await assert.rejects(
      operation === 'get'
        ? queries.getPanel('academy-dev', 'manager-dev')
        : queries.quote('academy-dev', 'manager-dev', 3, 10),
      /ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH/,
    )
  }
})

test('falha do backend e propagada sem repetir consulta', async () => {
  const { state, queries } = setup()
  state.afterRequest = () => {
    throw new Error('BACKEND_UNAVAILABLE')
  }

  await assert.rejects(
    queries.getPanel('academy-dev', 'manager-dev'),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(state.calls.length, 1)
})