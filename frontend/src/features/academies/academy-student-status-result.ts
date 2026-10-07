import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'

import type {
  MembershipStatus,
} from './academy-membership-context.ts'

import {
  isMembershipCursor,
} from './academy-membership-list.ts'

export type StudentChangeStatus = 'active' | 'suspended'

export interface AcademyStudentStatusResult {
  readonly membershipId: string
  readonly academyId: string
  readonly userId: string
  readonly status: MembershipStatus
  readonly alreadyProcessed: boolean
}

export interface ExpectedStudentStatusResult {
  readonly membershipId: string
  readonly academyId: string
  readonly targetUid: string
  readonly nextStatus: StudentChangeStatus
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function isMembershipStatus(
  value: unknown,
): value is MembershipStatus {
  return (
    value === 'pending' ||
    value === 'active' ||
    value === 'suspended' ||
    value === 'ended'
  )
}

export function normalizeAcademyStudentStatusResult(
  response: unknown,
  expected: ExpectedStudentStatusResult,
): AcademyStudentStatusResult {
  if (
    !isMembershipCursor(expected.membershipId) ||
    !isMembershipIdentifier(expected.academyId) ||
    !isMembershipIdentifier(expected.targetUid) ||
    (
      expected.nextStatus !== 'active' &&
      expected.nextStatus !== 'suspended'
    )
  ) {
    throw new Error('INVALID_STUDENT_STATUS_CONTEXT')
  }

  if (
    !isRecord(response) ||
    !isMembershipStatus(response.status) ||
    typeof response.alreadyProcessed !== 'boolean'
  ) {
    throw new Error('INVALID_STUDENT_STATUS_RESULT')
  }

  if (
    response.membershipId !== expected.membershipId ||
    response.academyId !== expected.academyId ||
    response.userId !== expected.targetUid
  ) {
    throw new Error('STUDENT_STATUS_CONTEXT_MISMATCH')
  }

  if (
    !response.alreadyProcessed &&
    response.status !== expected.nextStatus
  ) {
    throw new Error('INCONSISTENT_STUDENT_STATUS_RESULT')
  }

  return Object.freeze({
    membershipId: expected.membershipId,
    academyId: expected.academyId,
    userId: expected.targetUid,
    status: response.status,
    alreadyProcessed: response.alreadyProcessed,
  })
}