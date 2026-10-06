import {
  isMembershipIdentifier,
  normalizeAcademyMembershipContext,
} from './academy-membership-context.ts'
import type {
  AcademyMembershipContext,
} from './academy-membership-context.ts'

export interface MembershipSession {
  readonly uid: string
}

export interface MembershipRequest {
  academyId: string
}

interface MembershipQueryDependencies {
  getCurrentSession: () => MembershipSession | null
  requestMembership: (request: MembershipRequest) => Promise<unknown>
}

export function createAcademyMembershipQuery({
  getCurrentSession,
  requestMembership,
}: MembershipQueryDependencies) {
  return async function queryMembership(
    academyId: string,
    expectedUserId: string,
  ): Promise<AcademyMembershipContext | null> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    const session = getCurrentSession()

    if (!session) {
      throw new Error('AUTHENTICATION_REQUIRED')
    }

    const userId = session.uid

    if (userId !== expectedUserId) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const response = await requestMembership({ academyId })
    const currentSession = getCurrentSession()

    if (
      currentSession !== session ||
      currentSession?.uid !== userId
    ) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    return normalizeAcademyMembershipContext(response, {
      academyId,
      userId,
    })
  }
}