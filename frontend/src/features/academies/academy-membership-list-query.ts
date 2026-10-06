import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'
import {
  isMembershipCursor,
  normalizeAcademyMembershipPage,
} from './academy-membership-list.ts'
import type {
  AcademyMembershipPage,
} from './academy-membership-list.ts'
import type {
  MembershipSession,
} from './academy-membership-query.ts'

export interface MembershipListRequest {
  readonly cursor?: string
}

interface MembershipListQueryDependencies {
  getCurrentSession: () => MembershipSession | null
  requestPage: (request: MembershipListRequest) => Promise<unknown>
}

export function createAcademyMembershipListQuery({
  getCurrentSession,
  requestPage,
}: MembershipListQueryDependencies) {
  return async function queryMembershipPage(
    expectedUserId: string,
    cursor: string | null = null,
  ): Promise<AcademyMembershipPage> {
    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    if (cursor !== null && !isMembershipCursor(cursor)) {
      throw new Error('INVALID_MEMBERSHIP_CURSOR')
    }

    const session = getCurrentSession()

    if (!session) {
      throw new Error('AUTHENTICATION_REQUIRED')
    }

    const userId = session.uid

    if (userId !== expectedUserId) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const request: MembershipListRequest =
      cursor === null ? {} : { cursor }

    const response = await requestPage(request)
    const currentSession = getCurrentSession()

    if (
      currentSession !== session ||
      currentSession?.uid !== userId
    ) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    return normalizeAcademyMembershipPage(response, {
      userId,
      cursor,
    })
  }
}