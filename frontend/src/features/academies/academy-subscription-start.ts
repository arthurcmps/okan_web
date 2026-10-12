import { isMembershipIdentifier } from './academy-membership-context.ts'
import type { AcademyMembershipContext } from './academy-membership-context.ts'
import type { MembershipSession } from './academy-membership-query.ts'

import {
  normalizeAcademySubscriptionQuote,
} from './academy-subscription-result.ts'

import type {
  AcademySubscriptionQuote,
} from './academy-subscription-result.ts'

export interface AcademyStartInput {
  readonly quote: AcademySubscriptionQuote
  readonly attemptId: string
  readonly cardTokenId: string
}

export interface AcademyStartPayload {
  readonly academyId: string
  readonly quantidadeLicencas: number
  readonly diaCobranca: number
  readonly attemptId: string
  readonly cardTokenId: string
}

export interface AcademyStartResult {
  readonly academyId: string
  readonly attemptId: string
  readonly licenseQuantity: number
  readonly monthlyAmount: number
  readonly currency: 'BRL'
  readonly billingDay: number
  readonly providerStatus:
    | 'pending'
    | 'authorized'
    | 'paused'
    | 'canceled'
    | null
  readonly recovered: boolean
  readonly alreadyCompleted: boolean
}

interface Dependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  request: (payload: AcademyStartPayload) => Promise<unknown>
}

function canManage(academy: AcademyMembershipContext): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

function normalizeResult(
  value: unknown,
  quote: AcademySubscriptionQuote,
  attemptId: string,
): AcademyStartResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_ACADEMY_SUBSCRIPTION_RESPONSE')
  }

  const data = value as Record<string, unknown>

  if (
    data.academyId !== quote.academyId ||
    data.attemptId !== attemptId
  ) {
    throw new Error('ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH')
  }

  const statuses: readonly unknown[] = [
    null,
    'pending',
    'authorized',
    'paused',
    'canceled',
  ]

  if (
    data.licenseQuantity !== quote.licenseQuantity ||
    data.monthlyAmount !== quote.monthlyAmount ||
    data.currency !== quote.currency ||
    data.billingDay !== quote.billingDay ||
    !statuses.includes(data.providerStatus) ||
    typeof data.recovered !== 'boolean' ||
    typeof data.alreadyCompleted !== 'boolean'
  ) {
    throw new Error('INVALID_ACADEMY_SUBSCRIPTION_RESPONSE')
  }

  return Object.freeze({
    academyId: quote.academyId,
    attemptId,
    licenseQuantity: quote.licenseQuantity,
    monthlyAmount: quote.monthlyAmount,
    currency: 'BRL',
    billingDay: quote.billingDay,
    providerStatus:
      data.providerStatus as AcademyStartResult['providerStatus'],
    recovered: data.recovered,
    alreadyCompleted: data.alreadyCompleted,
  })
}

export function createAcademySubscriptionStart({
  getCurrentSession,
  getCurrentAcademy,
  request,
}: Dependencies) {
  let running = false

  return async function start(
    academyId: string,
    expectedUserId: string,
    input: AcademyStartInput,
  ): Promise<AcademyStartResult> {
    if (running) {
      throw new Error('ACADEMY_SUBSCRIPTION_IN_PROGRESS')
    }

    if (
      !isMembershipIdentifier(academyId) ||
      !isMembershipIdentifier(expectedUserId)
    ) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    const attemptId = input?.attemptId
    const token = input?.cardTokenId

    if (
      typeof attemptId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attemptId)
    ) {
      throw new Error('INVALID_SUBSCRIPTION_ATTEMPT_ID')
    }

    if (
      typeof token !== 'string' ||
      !token ||
      token.trim() !== token ||
      token.length > 200 ||
      Array.from(token).some((character) => {
        const code = character.charCodeAt(0)
        return code <= 31 || code === 127
      })
    ) {
      throw new Error('INVALID_CARD_TOKEN_ID')
    }

    const quote = normalizeAcademySubscriptionQuote(
      input.quote,
      academyId,
      input.quote?.licenseQuantity,
      input.quote?.billingDay,
    )

    const session = getCurrentSession()

    if (!session) {
      throw new Error('AUTHENTICATION_REQUIRED')
    }

    if (session.uid !== expectedUserId) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const academy = getCurrentAcademy()

    if (
      !academy ||
      academy.academyId !== academyId ||
      academy.userId !== expectedUserId
    ) {
      throw new Error('ACADEMY_CONTEXT_CHANGED')
    }

    if (!canManage(academy)) {
      throw new Error('ACADEMY_MANAGEMENT_FORBIDDEN')
    }

    running = true

    try {
      const response = await request({
        academyId,
        quantidadeLicencas: quote.licenseQuantity,
        diaCobranca: quote.billingDay,
        attemptId,
        cardTokenId: token,
      })

      const currentSession = getCurrentSession()
      const currentAcademy = getCurrentAcademy()

      if (
        currentSession !== session ||
        currentSession?.uid !== expectedUserId
      ) {
        throw new Error('AUTHENTICATION_CHANGED')
      }

      if (
        currentAcademy !== academy ||
        !currentAcademy ||
        currentAcademy.academyId !== academyId ||
        currentAcademy.userId !== expectedUserId ||
        !canManage(currentAcademy)
      ) {
        throw new Error('ACADEMY_CONTEXT_CHANGED')
      }

      return normalizeResult(response, quote, attemptId)
    } finally {
      running = false
    }
  }
}