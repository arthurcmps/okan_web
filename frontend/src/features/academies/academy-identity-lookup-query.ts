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
import type {
  AcademyIdentityLookupTicket,
} from './academy-identity-lookup-result.ts'

export interface AcademyIdentityLookupRequest {
  readonly academyId: string
  readonly email: string
}

interface LookupDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestLookup: (
    request: AcademyIdentityLookupRequest,
  ) => Promise<unknown>
  now?: () => number
}

function normalizeEmail(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('INVALID_ACADEMY_LOOKUP_EMAIL')
  }

  const email = value.trim().toLowerCase()
  const separator = email.indexOf('@')

  if (
    email.length === 0 ||
    email.length > 254 ||
    /\s/u.test(email) ||
Array.from(email).some((character) => {
  const code = character.codePointAt(0)!
  return code < 32 || (code >= 127 && code <= 159)
}) ||
    separator <= 0 ||
    separator === email.length - 1 ||
    separator !== email.lastIndexOf('@')
  ) {
    throw new Error('INVALID_ACADEMY_LOOKUP_EMAIL')
  }

  return email
}

export function createAcademyIdentityLookupQuery({
  getCurrentSession,
  getCurrentAcademy,
  requestLookup,
  now = Date.now,
}: LookupDependencies) {
  return async function lookupAccount(
    academyId: string,
    expectedUserId: string,
    email: string,
  ): Promise<AcademyIdentityLookupTicket | null> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    const normalizedEmail = normalizeEmail(email)
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

    const response = await requestLookup({
      academyId,
      email: normalizedEmail,
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

    const ticket = normalizeAcademyIdentityLookupResult(response)

    if (ticket !== null) {
      const nowMs = now()

      if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new Error('INVALID_IDENTITY_LOOKUP_CLOCK')
      }

      if (ticket.expiresAtMs <= nowMs) {
        throw new Error('IDENTITY_LOOKUP_TICKET_EXPIRED')
      }
    }

    return ticket
  }
}