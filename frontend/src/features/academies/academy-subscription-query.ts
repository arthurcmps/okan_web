import { isMembershipIdentifier } from './academy-membership-context.ts'
import type { AcademyMembershipContext } from './academy-membership-context.ts'
import type { MembershipSession } from './academy-membership-query.ts'
import {
  normalizeAcademySubscriptionPanel,
  normalizeAcademySubscriptionQuote,
} from './academy-subscription-result.ts'

export interface AcademySubscriptionPayload {
  readonly academyId: string
}

export interface AcademySubscriptionQuotePayload
  extends AcademySubscriptionPayload {
  readonly licenseQuantity: number
  readonly billingDay: number
}

interface Dependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  request: (
    payload: AcademySubscriptionPayload | AcademySubscriptionQuotePayload,
  ) => Promise<unknown>
}

function canManage(academy: AcademyMembershipContext): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

export function createAcademySubscriptionQueries({
  getCurrentSession,
  getCurrentAcademy,
  request,
}: Dependencies) {
  async function execute(
    academyId: string,
    expectedUserId: string,
    payload: AcademySubscriptionPayload | AcademySubscriptionQuotePayload,
  ) {
    if (
      !isMembershipIdentifier(academyId) ||
      !isMembershipIdentifier(expectedUserId)
    ) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    const session = getCurrentSession()
    if (!session) throw new Error('AUTHENTICATION_REQUIRED')

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

    const response = await request(payload)
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

    return response
  }

  return {
    async getPanel(academyId: string, expectedUserId: string) {
      const response = await execute(
        academyId,
        expectedUserId,
        { academyId },
      )

      return normalizeAcademySubscriptionPanel(response, academyId)
    },

    async quote(
      academyId: string,
      expectedUserId: string,
      licenseQuantity: number,
      billingDay: number,
    ) {
      if (
        !Number.isSafeInteger(licenseQuantity) ||
        licenseQuantity <= 0 ||
        !Number.isInteger(billingDay) ||
        billingDay < 1 ||
        billingDay > 28
      ) {
        throw new Error('INVALID_SUBSCRIPTION_QUOTE_INPUT')
      }

      const response = await execute(academyId, expectedUserId, {
        academyId,
        licenseQuantity,
        billingDay,
      })

      return normalizeAcademySubscriptionQuote(
        response,
        academyId,
        licenseQuantity,
        billingDay,
      )
    },
  }
}