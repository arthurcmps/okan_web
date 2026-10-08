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
  normalizeAcademyProfessorLicensePage,
} from './academy-professor-license-result.ts'
import type {
  AcademyProfessorLicensePage,
} from './academy-professor-license-result.ts'

export interface AcademyProfessorLicenseQueryPayload {
  readonly academyId: string
  readonly cursor: string | null
}

interface QueryDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestLicenses: (
    payload: AcademyProfessorLicenseQueryPayload,
  ) => Promise<unknown>
}

function canManage(academy: AcademyMembershipContext): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

export function createAcademyProfessorLicenseQuery({
  getCurrentSession,
  getCurrentAcademy,
  requestLicenses,
}: QueryDependencies) {
  return async function listLicenses(
    academyId: string,
    expectedUserId: string,
    cursor: string | null = null,
  ): Promise<AcademyProfessorLicensePage> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    if (cursor !== null && !isMembershipIdentifier(cursor)) {
      throw new Error('INVALID_PROFESSOR_LICENSE_CURSOR')
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

    const response = await requestLicenses({ academyId, cursor })

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

    const page = normalizeAcademyProfessorLicensePage(response, academyId)

    if (
      cursor !== null &&
      page.licenses.some((license) => license.licenseId <= cursor)
    ) {
      throw new Error('INVALID_PROFESSOR_LICENSE_RESPONSE')
    }

    return page
  }
}