export type MembershipRole = 'gym_admin' | 'professor' | 'aluno'

export type MembershipStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'ended'

export interface AcademyMembershipContext {
  readonly membershipId: string
  readonly schemaVersion: 1
  readonly academyId: string
  readonly userId: string
  readonly roles: readonly MembershipRole[]
  readonly status: MembershipStatus
  readonly canManage: boolean
}

interface ExpectedContext {
  academyId: string
  userId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

export function isMembershipIdentifier(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes('/') &&
    value !== '.' &&
    value !== '..'
  )
}

function isMembershipRole(value: unknown): value is MembershipRole {
  return (
    value === 'gym_admin' ||
    value === 'professor' ||
    value === 'aluno'
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

export function normalizeAcademyMembershipContext(
  response: unknown,
  { academyId, userId }: ExpectedContext,
): AcademyMembershipContext | null {
  if (
    !isMembershipIdentifier(academyId) ||
    !isMembershipIdentifier(userId)
  ) {
    throw new Error('INVALID_MEMBERSHIP_CONTEXT')
  }

  if (
    !isRecord(response) ||
    !Object.hasOwn(response, 'membership')
  ) {
    throw new Error('INVALID_MEMBERSHIP_RESPONSE')
  }

  if (response.membership === null) {
    return null
  }

  const membership = response.membership

  if (!isRecord(membership) || membership.schemaVersion !== 1) {
    throw new Error('INVALID_MEMBERSHIP_SCHEMA')
  }

  if (
    membership.academyId !== academyId ||
    membership.userId !== userId
  ) {
    throw new Error('MEMBERSHIP_CONTEXT_MISMATCH')
  }

  if (
    typeof membership.membershipId !== 'string' ||
    !/^membership_[a-f0-9]{64}$/.test(membership.membershipId)
  ) {
    throw new Error('INVALID_MEMBERSHIP_ID')
  }

  const roles = membership.roles

  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.length > 3
  ) {
    throw new Error('INVALID_MEMBERSHIP_ROLES')
  }

  const normalizedRoles = roles.map((role: unknown) => {
    if (!isMembershipRole(role)) {
      throw new Error('INVALID_MEMBERSHIP_ROLES')
    }

    return role
  })

  if (new Set(normalizedRoles).size !== normalizedRoles.length) {
    throw new Error('INVALID_MEMBERSHIP_ROLES')
  }

  if (!isMembershipStatus(membership.status)) {
    throw new Error('INVALID_MEMBERSHIP_STATUS')
  }

  const expectedCanManage =
    membership.status === 'active' &&
    normalizedRoles.includes('gym_admin')

  if (
    typeof membership.canManage !== 'boolean' ||
    membership.canManage !== expectedCanManage
  ) {
    throw new Error('INVALID_MEMBERSHIP_PERMISSION')
  }

  return Object.freeze({
    membershipId: membership.membershipId,
    schemaVersion: 1,
    academyId,
    userId,
    roles: Object.freeze([...normalizedRoles].sort()),
    status: membership.status,
    canManage: membership.canManage,
  })
}