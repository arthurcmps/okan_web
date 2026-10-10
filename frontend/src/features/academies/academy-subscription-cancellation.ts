import { isMembershipIdentifier } from './academy-membership-context.ts'
import type { AcademyMembershipContext } from './academy-membership-context.ts'
import type { MembershipSession } from './academy-membership-query.ts'

export interface AcademyCancellationResult {
  readonly academyId: string
  readonly status: 'canceled'
  readonly providerStatus: 'canceled'
  readonly alreadyCanceled: boolean
}

interface Dependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  request: (payload: { academyId: string }) => Promise<unknown>
}

function canManage(academy: AcademyMembershipContext): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

export function createAcademySubscriptionCancellation({
  getCurrentSession,
  getCurrentAcademy,
  request,
}: Dependencies) {
  return async function cancel(
    academyId: string,
    expectedUserId: string,
  ): Promise<AcademyCancellationResult> {
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

    const response = await request({ academyId })
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

    if (
      !response ||
      typeof response !== 'object' ||
      Array.isArray(response)
    ) {
      throw new Error('INVALID_ACADEMY_SUBSCRIPTION_RESPONSE')
    }

    const data = response as Record<string, unknown>

    if (data.academyId !== academyId) {
      throw new Error('ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH')
    }

    if (
      data.status !== 'canceled' ||
      data.providerStatus !== 'canceled' ||
      typeof data.alreadyCanceled !== 'boolean'
    ) {
      throw new Error('INVALID_ACADEMY_SUBSCRIPTION_RESPONSE')
    }

    return Object.freeze({
      academyId,
      status: 'canceled',
      providerStatus: 'canceled',
      alreadyCanceled: data.alreadyCanceled,
    })
  }
}