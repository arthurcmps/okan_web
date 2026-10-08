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
  normalizeAcademySentLinkRequestPage,
} from './academy-sent-link-request-result.ts'
import type {
  AcademySentLinkRequestPage,
} from './academy-sent-link-request-result.ts'

export interface AcademySentLinkRequestQueryPayload {
  readonly academyId: string
  readonly cursor: string | null
}

interface QueryDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestPage: (
    payload: AcademySentLinkRequestQueryPayload,
  ) => Promise<unknown>
}

function canManage(
  academy: AcademyMembershipContext,
): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

export function createAcademySentLinkRequestQuery({
  getCurrentSession,
  getCurrentAcademy,
  requestPage,
}: QueryDependencies) {
  return async function listSentRequests(
    academyId: string,
    expectedUserId: string,
    cursor: string | null = null,
  ): Promise<AcademySentLinkRequestPage> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    if (
      cursor !== null &&
      (
        typeof cursor !== 'string' ||
        cursor !== cursor.trim() ||
        !/^[a-zA-Z0-9_-]{16,80}$/.test(cursor)
      )
    ) {
      throw new Error('INVALID_SENT_LINK_REQUEST_CURSOR')
    }

    const initialSession = getCurrentSession()

    if (!initialSession) {
      throw new Error('AUTHENTICATION_REQUIRED')
    }

    if (initialSession.uid !== expectedUserId) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const initialAcademy = getCurrentAcademy()

    if (
      !initialAcademy ||
      initialAcademy.academyId !== academyId ||
      initialAcademy.userId !== expectedUserId
    ) {
      throw new Error('ACADEMY_CONTEXT_CHANGED')
    }

    if (!canManage(initialAcademy)) {
      throw new Error('ACADEMY_MANAGEMENT_FORBIDDEN')
    }

    const response = await requestPage({
      academyId,
      cursor,
    })

    const currentSession = getCurrentSession()

    if (
      currentSession !== initialSession ||
      currentSession?.uid !== expectedUserId
    ) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const currentAcademy = getCurrentAcademy()

    if (
      currentAcademy !== initialAcademy ||
      !currentAcademy ||
      currentAcademy.academyId !== academyId ||
      currentAcademy.userId !== expectedUserId ||
      !canManage(currentAcademy)
    ) {
      throw new Error('ACADEMY_CONTEXT_CHANGED')
    }

    const page = normalizeAcademySentLinkRequestPage(response)

    for (const request of page.requests) {
      if (request.academyId !== academyId) {
        throw new Error('SENT_LINK_REQUEST_CONTEXT_MISMATCH')
      }

      if (cursor !== null && request.requestId <= cursor) {
        throw new Error('INVALID_SENT_LINK_REQUEST_RESPONSE')
      }
    }

    return page
  }
}