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
  normalizeAcademyStudentsPage,
} from './academy-students-page.ts'

import type {
  AcademyStudentMembership,
} from './academy-students-page.ts'

import {
  normalizeAcademyStudentStatusResult,
} from './academy-student-status-result.ts'

import type {
  AcademyStudentStatusResult,
  StudentChangeStatus,
} from './academy-student-status-result.ts'

export interface AcademyStudentStatusRequest {
  readonly academyId: string
  readonly targetUid: string
  readonly expectedStatus: StudentChangeStatus
  readonly nextStatus: StudentChangeStatus
  readonly requestId: string
}

export interface AcademyStudentStatusAction {
  readonly student: AcademyStudentMembership
  readonly expectedUserId: string
  readonly nextStatus: StudentChangeStatus
  readonly requestId: string
}

interface StatusCommandDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestChange: (
    request: AcademyStudentStatusRequest,
  ) => Promise<unknown>
}

export function createAcademyStudentStatusCommand({
  getCurrentSession,
  getCurrentAcademy,
  requestChange,
}: StatusCommandDependencies) {
  return async function changeStudentStatus({
    student,
    expectedUserId,
    nextStatus,
    requestId,
  }: AcademyStudentStatusAction): Promise<AcademyStudentStatusResult> {
    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    if (
      typeof requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)
    ) {
      throw new Error('INVALID_STUDENT_STATUS_REQUEST_ID')
    }

    const session = getCurrentSession()

    if (!session) {
      throw new Error('AUTHENTICATION_REQUIRED')
    }

    if (session.uid !== expectedUserId) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    const academy = getCurrentAcademy()

    if (!academy || academy.userId !== expectedUserId) {
      throw new Error('ACADEMY_CONTEXT_CHANGED')
    }

    if (
      academy.status !== 'active' ||
      !academy.canManage ||
      !academy.roles.includes('gym_admin')
    ) {
      throw new Error('ACADEMY_MANAGEMENT_FORBIDDEN')
    }

    const page = normalizeAcademyStudentsPage(
      { students: [student], nextCursor: null },
      { academyId: academy.academyId },
    )

    const target = page.students[0]

    if (!target) {
      throw new Error('INVALID_STUDENT_MEMBERSHIP')
    }

    if (
      target.userId === expectedUserId ||
      target.roles.includes('gym_admin')
    ) {
      throw new Error('STUDENT_STATUS_TARGET_FORBIDDEN')
    }

    if (
      (
        target.status !== 'active' &&
        target.status !== 'suspended'
      ) ||
      (
        nextStatus !== 'active' &&
        nextStatus !== 'suspended'
      ) ||
      target.status === nextStatus
    ) {
      throw new Error('INVALID_STUDENT_STATUS_CHANGE')
    }

    const request: AcademyStudentStatusRequest = {
      academyId: academy.academyId,
      targetUid: target.userId,
      expectedStatus: target.status,
      nextStatus,
      requestId,
    }

    const response = await requestChange(request)

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
      currentAcademy?.academyId !== academy.academyId ||
      currentAcademy?.userId !== expectedUserId ||
      currentAcademy?.status !== 'active' ||
      !currentAcademy?.canManage ||
      !currentAcademy?.roles.includes('gym_admin')
    ) {
      throw new Error('ACADEMY_CONTEXT_CHANGED')
    }

    return normalizeAcademyStudentStatusResult(response, {
      membershipId: target.membershipId,
      academyId: academy.academyId,
      targetUid: target.userId,
      nextStatus,
    })
  }
}