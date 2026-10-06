import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'
import type {
  AcademyMembershipContext,
} from './academy-membership-context.ts'
import {
  isMembershipCursor,
} from './academy-membership-list.ts'
import type {
  MembershipSession,
} from './academy-membership-query.ts'
import {
  normalizeAcademyStudentsPage,
} from './academy-students-page.ts'
import type {
  AcademyStudentsPage,
} from './academy-students-page.ts'

export interface AcademyStudentsRequest {
  readonly academyId: string
  readonly cursor?: string
}

interface AcademyStudentsQueryDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestPage: (request: AcademyStudentsRequest) => Promise<unknown>
}

export function createAcademyStudentsQuery({
  getCurrentSession,
  getCurrentAcademy,
  requestPage,
}: AcademyStudentsQueryDependencies) {
  return async function queryStudents(
    academyId: string,
    expectedUserId: string,
    cursor: string | null = null,
  ): Promise<AcademyStudentsPage> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

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

    const request: AcademyStudentsRequest = cursor === null
      ? { academyId }
      : { academyId, cursor }

    const response = await requestPage(request)

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

    return normalizeAcademyStudentsPage(response, {
      academyId,
      cursor,
    })
  }
}