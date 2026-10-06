import {
  isMembershipIdentifier,
  normalizeAcademyMembershipContext,
} from './academy-membership-context.ts'
import type {
  AcademyMembershipContext,
} from './academy-membership-context.ts'

export const MEMBERSHIP_PAGE_SIZE = 20

export interface AcademyMembershipListItem
  extends AcademyMembershipContext {
  readonly academyName: string | null
}

export interface AcademyMembershipPage {
  readonly memberships: readonly AcademyMembershipListItem[]
  readonly nextCursor: string | null
}

interface ExpectedPageContext {
  readonly userId: string
  readonly cursor?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function normalizeAcademyName(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('INVALID_ACADEMY_DISPLAY_NAME')
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
    throw new Error('INVALID_ACADEMY_DISPLAY_NAME')
  }

  return name
}

export function isMembershipCursor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^membership_[a-f0-9]{64}$/.test(value)
  )
}

export function normalizeAcademyMembershipPage(
  response: unknown,
  { userId, cursor = null }: ExpectedPageContext,
): AcademyMembershipPage {
  if (!isMembershipIdentifier(userId)) {
    throw new Error('INVALID_MEMBERSHIP_CONTEXT')
  }

  if (cursor !== null && !isMembershipCursor(cursor)) {
    throw new Error('INVALID_MEMBERSHIP_CURSOR')
  }

  if (
    !isRecord(response) ||
    !Object.hasOwn(response, 'memberships') ||
    !Object.hasOwn(response, 'nextCursor')
  ) {
    throw new Error('INVALID_MEMBERSHIP_PAGE')
  }

  const items: unknown = response.memberships
  const nextCursor: unknown = response.nextCursor

  if (
    !Array.isArray(items) ||
    items.length > MEMBERSHIP_PAGE_SIZE ||
    (nextCursor !== null && !isMembershipCursor(nextCursor))
  ) {
    throw new Error('INVALID_MEMBERSHIP_PAGE')
  }

  const memberships: AcademyMembershipListItem[] = []
  const academyIds = new Set<string>()
  let previousId = cursor

  for (const item of items as unknown[]) {
    if (!isRecord(item) || !isMembershipIdentifier(item.academyId)) {
      throw new Error('INVALID_MEMBERSHIP_PAGE')
    }

    const membership = normalizeAcademyMembershipContext(
      { membership: item },
      { academyId: item.academyId, userId },
    )

    if (membership === null) {
      throw new Error('INVALID_MEMBERSHIP_PAGE')
    }

    if (
      previousId !== null &&
      membership.membershipId <= previousId
    ) {
      throw new Error('INVALID_MEMBERSHIP_PAGE_ORDER')
    }

    if (academyIds.has(membership.academyId)) {
      throw new Error('DUPLICATE_MEMBERSHIP_ACADEMY')
    }

    academyIds.add(membership.academyId)

    memberships.push(Object.freeze({
      ...membership,
      academyName: normalizeAcademyName(item.academyName),
    }))

    previousId = membership.membershipId
  }

  if (
    nextCursor !== null &&
    (
      memberships.length !== MEMBERSHIP_PAGE_SIZE ||
      nextCursor !== previousId
    )
  ) {
    throw new Error('INVALID_MEMBERSHIP_NEXT_CURSOR')
  }

  return Object.freeze({
    memberships: Object.freeze(memberships),
    nextCursor,
  })
}