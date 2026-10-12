import { isMembershipIdentifier } from './academy-membership-context.ts'
import { normalizeAcademySubscriptionQuote } from './academy-subscription-result.ts'
import type { AcademySubscriptionQuote } from './academy-subscription-result.ts'

export interface DevSubscriptionAttempt {
  readonly schemaVersion: 1
  readonly academyId: string
  readonly userId: string
  readonly attemptId: string
  readonly quote: AcademySubscriptionQuote
}

interface AttemptStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function key(academyId: string, userId: string): string {
  if (!isMembershipIdentifier(academyId) || !isMembershipIdentifier(userId)) {
    throw new Error('INVALID_MEMBERSHIP_CONTEXT')
  }

  return `okan:dev:subscription:${JSON.stringify([academyId, userId])}`
}

function isAttemptId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}

export function loadDevSubscriptionAttempt(
  storage: AttemptStorage,
  academyId: string,
  userId: string,
): DevSubscriptionAttempt | null {
  const raw = storage.getItem(key(academyId, userId))
  if (raw === null) return null

  try {
    const data: unknown = JSON.parse(raw)

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('INVALID_PENDING_SUBSCRIPTION')
    }

    const record = data as Record<string, unknown>

    if (
      record.schemaVersion !== 1 ||
      record.academyId !== academyId ||
      record.userId !== userId ||
      !isAttemptId(record.attemptId)
    ) {
      throw new Error('INVALID_PENDING_SUBSCRIPTION')
    }

    const candidate = record.quote as AcademySubscriptionQuote | undefined

    const quote = normalizeAcademySubscriptionQuote(
      candidate,
      academyId,
      candidate?.licenseQuantity ?? 0,
      candidate?.billingDay ?? 0,
    )

    return Object.freeze({
      schemaVersion: 1,
      academyId,
      userId,
      attemptId: record.attemptId,
      quote,
    })
  } catch {
    throw new Error('INVALID_PENDING_SUBSCRIPTION')
  }
}

export function prepareDevSubscriptionAttempt(
  storage: AttemptStorage,
  academyId: string,
  userId: string,
  value: AcademySubscriptionQuote,
  createId: () => string,
): DevSubscriptionAttempt {
  const quote = normalizeAcademySubscriptionQuote(
    value,
    academyId,
    value.licenseQuantity,
    value.billingDay,
  )

  const pending = loadDevSubscriptionAttempt(storage, academyId, userId)

  if (pending) {
    if (
      pending.quote.licenseQuantity !== quote.licenseQuantity ||
      pending.quote.billingDay !== quote.billingDay ||
      pending.quote.monthlyAmount !== quote.monthlyAmount ||
      pending.quote.currency !== quote.currency
    ) {
      throw new Error('ACADEMY_SUBSCRIPTION_ATTEMPT_PENDING')
    }

    return pending
  }

  const attemptId = createId()

  if (!isAttemptId(attemptId)) {
    throw new Error('INVALID_SUBSCRIPTION_ATTEMPT_ID')
  }

  const attempt: DevSubscriptionAttempt = Object.freeze({
    schemaVersion: 1,
    academyId,
    userId,
    attemptId,
    quote,
  })

  storage.setItem(key(academyId, userId), JSON.stringify(attempt))

  return attempt
}

export function clearDevSubscriptionAttempt(
  storage: AttemptStorage,
  academyId: string,
  userId: string,
  attemptId: string,
): void {
  const pending = loadDevSubscriptionAttempt(storage, academyId, userId)

  if (pending?.attemptId === attemptId) {
    storage.removeItem(key(academyId, userId))
  }
}