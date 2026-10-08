import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'
import type {
  AcademyMembershipContext,
} from './academy-membership-context.ts'
import type {
  MembershipSession,
} from './academy-membership-query.ts'
import {
  normalizeAcademyIdentityLookupResult,
} from './academy-identity-lookup-result.ts'
import {
  normalizeAcademyLinkRequestResult,
} from './academy-link-request-result.ts'
import type {
  AcademyLinkRequestResult,
} from './academy-link-request-result.ts'

export interface AcademyLinkRequestPayload {
  readonly academyId: string
  readonly ticketId: string
}

interface CommandDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  sendRequest: (
    payload: AcademyLinkRequestPayload,
  ) => Promise<unknown>
  now?: () => number
}

export function createAcademyLinkRequestCommand({
  getCurrentSession,
  getCurrentAcademy,
  sendRequest,
  now = Date.now,
}: CommandDependencies) {
  return async function requestLink(
    academyId: string,
    expectedUserId: string,
    lookupTicket: unknown,
  ): Promise<AcademyLinkRequestResult> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

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

    if (
      academy.status !== 'active' ||
      !academy.canManage ||
      !academy.roles.includes('gym_admin')
    ) {
      throw new Error('ACADEMY_MANAGEMENT_FORBIDDEN')
    }

    const ticket = normalizeAcademyIdentityLookupResult(lookupTicket)

    if (ticket === null) {
      throw new Error('IDENTITY_LOOKUP_TICKET_REQUIRED')
    }

    const nowMs = now()

    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error('INVALID_IDENTITY_LOOKUP_CLOCK')
    }

    if (ticket.expiresAtMs <= nowMs) {
      throw new Error('IDENTITY_LOOKUP_TICKET_EXPIRED')
    }

    const response = await sendRequest({
      academyId,
      ticketId: ticket.ticketId,
    })

    const currentSession = getCurrentSession()

    if (
      currentSession !== session ||
      currentSession?.uid !== expectedUserId
    ) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const currentAcademy = getCurrentAcademy()

    if (
      currentAcademy !== academy ||
      currentAcademy?.academyId !== academyId ||
      currentAcademy?.userId !== expectedUserId ||
      currentAcademy?.status !== 'active' ||
      !currentAcademy?.canManage ||
      !currentAcademy?.roles.includes('gym_admin')
    ) {
      throw new Error('ACADEMY_CONTEXT_CHANGED')
    }

    return normalizeAcademyLinkRequestResult(response)
  }
}