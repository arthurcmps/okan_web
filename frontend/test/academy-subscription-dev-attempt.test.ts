import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearDevSubscriptionAttempt,
  loadDevSubscriptionAttempt,
  prepareDevSubscriptionAttempt,
} from '../src/features/academies/academy-subscription-dev-attempt.ts'

const id = '550e8400-e29b-41d4-a716-446655440000'
const otherId = '123e4567-e89b-42d3-a456-426614174000'

const quote = {
  schemaVersion: 1 as const,
  academyId: 'academy-dev',
  academyName: 'Academia',
  licenseQuantity: 3,
  currentLicensesUsed: 1,
  unitMonthlyAmount: 45,
  monthlyAmount: 135,
  currency: 'BRL' as const,
  billingDay: 10,
}

function setup() {
  const values = new Map<string, string>()

  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }

  return { storage, values }
}

test('mantem mesma tentativa apos repeticao e recarregamento', () => {
  const { storage } = setup()
  let generated = 0

  const createId = () => {
    generated += 1
    return id
  }

  const first = prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, createId,
  )

  const restored = loadDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev',
  )

  const second = prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, createId,
  )

  assert.equal(first.attemptId, restored?.attemptId)
  assert.equal(second.attemptId, first.attemptId)
  assert.equal(generated, 1)
  assert.equal(Object.isFrozen(restored), true)
})

test('nao persiste token ou campos extras', () => {
  const { storage, values } = setup()

  prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev',
    {
      ...quote,
      cardTokenId: 'private-token',
      ownerUid: 'private-owner',
    } as typeof quote,
    () => id,
  )

  const stored = [...values.values()][0]

  assert.equal(stored.includes('private-token'), false)
  assert.equal(stored.includes('private-owner'), false)
})

test('cotacao diferente nao substitui tentativa incerta', () => {
  const { storage } = setup()

  prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => id,
  )

  assert.throws(() => prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev',
    {
      ...quote,
      licenseQuantity: 4,
      monthlyAmount: 180,
    },
    () => otherId,
  ), /ACADEMY_SUBSCRIPTION_ATTEMPT_PENDING/)

  assert.equal(
    loadDevSubscriptionAttempt(
      storage, 'academy-dev', 'manager-dev',
    )?.attemptId,
    id,
  )
})

test('academia e usuario isolam tentativas', () => {
  const { storage } = setup()

  prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => id,
  )

  assert.equal(
    loadDevSubscriptionAttempt(storage, 'academy-dev', 'other-user'),
    null,
  )

  assert.equal(
    loadDevSubscriptionAttempt(storage, 'other-academy', 'manager-dev'),
    null,
  )
})

test('limpa somente tentativa correspondente', () => {
  const { storage } = setup()

  prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => id,
  )

  clearDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', otherId,
  )

  assert.notEqual(
    loadDevSubscriptionAttempt(storage, 'academy-dev', 'manager-dev'),
    null,
  )

  clearDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', id,
  )

  assert.equal(
    loadDevSubscriptionAttempt(storage, 'academy-dev', 'manager-dev'),
    null,
  )

  const next = prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => otherId,
  )

  assert.equal(next.attemptId, otherId)
})

test('dados corrompidos nao sao sobrescritos automaticamente', () => {
  const { storage, values } = setup()

  prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => id,
  )

  const key = [...values.keys()][0]
  values.set(key, '{invalid-json')

  assert.throws(() => prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => otherId,
  ), /INVALID_PENDING_SUBSCRIPTION/)

  assert.equal(values.get(key), '{invalid-json')
})

test('UUID invalido e erro de armazenamento impedem preparacao', () => {
  const { storage } = setup()

  assert.throws(() => prepareDevSubscriptionAttempt(
    storage, 'academy-dev', 'manager-dev', quote, () => 'invalid',
  ), /INVALID_SUBSCRIPTION_ATTEMPT_ID/)

  assert.throws(() => prepareDevSubscriptionAttempt(
    {
      ...storage,
      setItem: () => {
        throw new Error('STORAGE_BLOCKED')
      },
    },
    'academy-dev',
    'manager-dev',
    quote,
    () => id,
  ), /STORAGE_BLOCKED/)
})