import {
  isMembershipIdentifier,
  normalizeAcademyMembershipContext,
} from './academy-membership-context.ts'
import type {
  AcademyMembershipContext,
} from './academy-membership-context.ts'
import {
  isMembershipCursor,
  MEMBERSHIP_PAGE_SIZE,
} from './academy-membership-list.ts'

export type AcademyStudentMembership =
  Omit<AcademyMembershipContext, 'canManage'> & {
    readonly studentName: string | null
  }

export interface AcademyStudentsPage {
  readonly students: readonly AcademyStudentMembership[]
  readonly nextCursor: string | null
}

interface ExpectedStudentsContext {
  readonly academyId: string
  readonly cursor?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function normalizeStudentName(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('INVALID_STUDENT_NAME')
  }

  const name = value.trim()

  if (
    name.length === 0 ||
    name.length > 200 ||
    Array.from(name).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  ) {
    throw new Error('INVALID_STUDENT_NAME')
  }

  return name
}

export function normalizeAcademyStudentsPage(
  response: unknown,
  { academyId, cursor = null }: ExpectedStudentsContext,
): AcademyStudentsPage {
  if (!isMembershipIdentifier(academyId)) {
    throw new Error('INVALID_ACADEMY_ID')
  }

  if (cursor !== null && !isMembershipCursor(cursor)) {
    throw new Error('INVALID_MEMBERSHIP_CURSOR')
  }

  if (
    !isRecord(response) ||
    !Object.hasOwn(response, 'students') ||
    !Object.hasOwn(response, 'nextCursor')
  ) {
    throw new Error('INVALID_STUDENTS_PAGE')
  }

  const items: unknown = response.students
  const nextCursor: unknown = response.nextCursor

  if (
    !Array.isArray(items) ||
    items.length > MEMBERSHIP_PAGE_SIZE ||
    (nextCursor !== null && !isMembershipCursor(nextCursor))
  ) {
    throw new Error('INVALID_STUDENTS_PAGE')
  }

  const students: AcademyStudentMembership[] = []
  const userIds = new Set<string>()
  let previousId = cursor

  for (const item of items as unknown[]) {
    if (!isRecord(item) || !isMembershipIdentifier(item.userId)) {
      throw new Error('INVALID_STUDENT_MEMBERSHIP')
    }

    const roles: unknown = item.roles

    if (!Array.isArray(roles) || !roles.includes('aluno')) {
      throw new Error('INVALID_STUDENT_MEMBERSHIP')
    }

    // Reutiliza a validação do contrato do vínculo.
    // A permissão calculada aqui não é devolvida nem autoriza operações.
    const membership = normalizeAcademyMembershipContext(
      {
        membership: {
          ...item,
          canManage:
            item.status === 'active' && roles.includes('gym_admin'),
        },
      },
      {
        academyId,
        userId: item.userId,
      },
    )

    if (membership === null) {
      throw new Error('INVALID_STUDENT_MEMBERSHIP')
    }

    if (
      previousId !== null &&
      membership.membershipId <= previousId
    ) {
      throw new Error('INVALID_STUDENTS_PAGE_ORDER')
    }

    if (userIds.has(membership.userId)) {
      throw new Error('DUPLICATE_ACADEMY_STUDENT')
    }

    userIds.add(membership.userId)

    students.push(Object.freeze({
      membershipId: membership.membershipId,
      schemaVersion: membership.schemaVersion,
      academyId: membership.academyId,
      userId: membership.userId,
      roles: membership.roles,
      status: membership.status,
      studentName: normalizeStudentName(item.studentName),
    }))

    previousId = membership.membershipId
  }

  if (
    nextCursor !== null &&
    (
      students.length !== MEMBERSHIP_PAGE_SIZE ||
      nextCursor !== previousId
    )
  ) {
    throw new Error('INVALID_STUDENTS_NEXT_CURSOR')
  }

  return Object.freeze({
    students: Object.freeze(students),
    nextCursor,
  })
}