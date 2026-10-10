import { isMembershipIdentifier } from './academy-membership-context.ts'

export type SubscriptionStatus =
  | 'creating'
  | 'active'
  | 'paused'
  | 'canceled'
  | 'expired'
  | 'failed'

export type BillingStatus =
  | 'scheduled'
  | 'current'
  | 'processing'
  | 'retrying'
  | 'past_due'

export interface AcademySubscription {
  readonly status: SubscriptionStatus
  readonly billingStatus: BillingStatus | null
  readonly licenseQuantity: number
  readonly monthlyAmount: number
  readonly currency: 'BRL'
  readonly billingDay: number
  readonly billingDebitDate: string | null
  readonly accessAllowed: boolean
  readonly accessGrace: boolean
  readonly accessReason: string
}

export interface AcademySubscriptionPanelResult {
  readonly academyId: string
  readonly academyName: string | null
  readonly licensesTotal: number
  readonly licensesUsed: number
  readonly licensesAvailable: number
  readonly subscription: AcademySubscription | null
  readonly legacyBilling: Readonly<{
    detected: boolean
    requiresMigration: boolean
    status: string | null
  }>
}

export interface AcademySubscriptionQuote {
  readonly schemaVersion: 1
  readonly academyId: string
  readonly academyName: string | null
  readonly licenseQuantity: number
  readonly currentLicensesUsed: number
  readonly unitMonthlyAmount: number
  readonly monthlyAmount: number
  readonly currency: 'BRL'
  readonly billingDay: number
}

function invalid(): never {
  throw new Error('INVALID_ACADEMY_SUBSCRIPTION_RESPONSE')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid()
  }

  return value as Record<string, unknown>
}

function count(value: unknown, minimum = 0): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    return invalid()
  }

  return value
}

function money(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isSafeInteger(Math.round(value * 100)) ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  ) {
    return invalid()
  }

  return value
}

function day(value: unknown): number {
  const result = count(value, 1)
  if (result > 28) return invalid()
  return result
}

function name(value: unknown): string | null {
  if (value === null) return null

  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > 200 ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  ) {
    return invalid()
  }

  return value
}

function context(value: unknown, academyId: string) {
  if (!isMembershipIdentifier(academyId)) return invalid()

  const data = record(value)
  if (!isMembershipIdentifier(data.academyId)) return invalid()

  if (data.academyId !== academyId) {
    throw new Error('ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH')
  }

  return data
}

function subscription(value: unknown): AcademySubscription | null {
  if (value === null) return null

  const data = record(value)
  const statuses: readonly unknown[] = [
    'creating', 'active', 'paused', 'canceled', 'expired', 'failed',
  ]
  const billingStatuses: readonly unknown[] = [
    null, 'scheduled', 'current', 'processing', 'retrying', 'past_due',
  ]

  if (
    !statuses.includes(data.status) ||
    !billingStatuses.includes(data.billingStatus) ||
    data.currency !== 'BRL' ||
    typeof data.accessAllowed !== 'boolean' ||
    typeof data.accessGrace !== 'boolean'
  ) {
    return invalid()
  }

  const status = data.status as SubscriptionStatus
  const billingStatus = data.billingStatus as BillingStatus | null
  const allowed = data.accessAllowed
  const grace = data.accessGrace
  const reason = data.accessReason

  let consistent = false

  if (status !== 'active') {
    consistent = !allowed && !grace && reason === 'subscription_not_active'
  } else {
    switch (billingStatus) {
      case 'current':
        consistent = allowed && !grace && reason === 'billing_current'
        break
      case 'past_due':
        consistent = !allowed && !grace && reason === 'billing_past_due'
        break
      case 'processing':
      case 'retrying':
        consistent = (
          allowed && grace && reason === 'billing_grace'
        ) || (
          !allowed && !grace && reason === 'awaiting_first_payment'
        )
        break
      case 'scheduled':
        consistent = !grace && (
          (allowed && reason === 'next_charge_scheduled') ||
          (!allowed && reason === 'awaiting_first_payment')
        )
        break
      case null:
        consistent = !allowed && !grace && reason === 'billing_not_initialized'
        break
    }
  }

  if (!consistent || typeof reason !== 'string') return invalid()

  const debitDate = data.billingDebitDate

  if (
    debitDate !== null &&
    (
      typeof debitDate !== 'string' ||
      !Number.isFinite(Date.parse(debitDate)) ||
      new Date(debitDate).toISOString() !== debitDate
    )
  ) {
    return invalid()
  }

  return Object.freeze({
    status,
    billingStatus,
    licenseQuantity: count(data.licenseQuantity, 1),
    monthlyAmount: money(data.monthlyAmount),
    currency: 'BRL',
    billingDay: day(data.billingDay),
    billingDebitDate: debitDate as string | null,
    accessAllowed: allowed,
    accessGrace: grace,
    accessReason: reason,
  })
}

export function normalizeAcademySubscriptionPanel(
  value: unknown,
  academyId: string,
): AcademySubscriptionPanelResult {
  const data = context(value, academyId)
  const total = count(data.licensesTotal)
  const used = count(data.licensesUsed)
  const available = count(data.licensesAvailable)
  const currentSubscription = subscription(data.subscription)
  const legacy = record(data.legacyBilling)

  const legacyStatuses: readonly unknown[] = [
    null,
    'Ativa',
    'Pendente',
    'Aguardando Pagamento',
    'Inadimplente',
    'Cancelada',
    'unknown',
  ]

  if (
    used > total ||
    available !== total - used ||
    typeof legacy.detected !== 'boolean' ||
    typeof legacy.requiresMigration !== 'boolean' ||
    !legacyStatuses.includes(legacy.status) ||
    (legacy.requiresMigration && !legacy.detected) ||
    (!legacy.detected && legacy.status !== null) ||
    (
      currentSubscription !== null &&
      (legacy.detected || legacy.requiresMigration || legacy.status !== null)
    )
  ) {
    return invalid()
  }

  return Object.freeze({
    academyId,
    academyName: name(data.academyName),
    licensesTotal: total,
    licensesUsed: used,
    licensesAvailable: available,
    subscription: currentSubscription,
    legacyBilling: Object.freeze({
      detected: legacy.detected,
      requiresMigration: legacy.requiresMigration,
      status: legacy.status as string | null,
    }),
  })
}

export function normalizeAcademySubscriptionQuote(
  value: unknown,
  academyId: string,
  licenseQuantity: number,
  billingDay: number,
): AcademySubscriptionQuote {
  const data = context(value, academyId)
  const quantity = count(data.licenseQuantity, 1)
  const used = count(data.currentLicensesUsed)
  const unit = money(data.unitMonthlyAmount)
  const amount = money(data.monthlyAmount)
  const chargingDay = day(data.billingDay)

  if (
    data.schemaVersion !== 1 ||
    data.currency !== 'BRL' ||
    quantity !== licenseQuantity ||
    chargingDay !== billingDay ||
    used > quantity ||
    !Number.isSafeInteger(Math.round(unit * 100) * quantity) ||
    Math.round(unit * 100) * quantity !== Math.round(amount * 100)
  ) {
    return invalid()
  }

  return Object.freeze({
    schemaVersion: 1,
    academyId,
    academyName: name(data.academyName),
    licenseQuantity: quantity,
    currentLicensesUsed: used,
    unitMonthlyAmount: unit,
    monthlyAmount: amount,
    currency: 'BRL',
    billingDay: chargingDay,
  })
}