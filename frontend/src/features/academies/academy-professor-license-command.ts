import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'
import type {
  AcademyMembershipContext,
} from './academy-membership-context.ts'
import type {
  MembershipSession,
} from './academy-membership-query.ts'

export type AcademyLicenseOperation =
  | {
    readonly kind: 'grant'
    readonly payload: {
      readonly academyId: string
      readonly professorEmail: string
    }
  }
  | {
    readonly kind: 'revoke'
    readonly payload: {
      readonly academyId: string
      readonly licenseId: string
    }
  }

export interface AcademyLicenseMutationResult {
  readonly academyId: string
  readonly licenseId: string
  readonly licensesTotal: number
  readonly licensesUsed: number
  readonly alreadyProcessed: boolean
}

interface Dependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestOperation: (operation: AcademyLicenseOperation) => Promise<unknown>
}

function canManage(academy: AcademyMembershipContext): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('INVALID_PROFESSOR_EMAIL')
  }

  const email = value.trim().toLowerCase()
  const separator = email.indexOf('@')

  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || (code >= 127 && code <= 159)
  })

  if (
    email.length === 0 ||
    email.length > 254 ||
    /\s/u.test(email) ||
    hasControlCharacter ||
    separator <= 0 ||
    separator !== email.lastIndexOf('@') ||
    separator === email.length - 1
  ) {
    throw new Error('INVALID_PROFESSOR_EMAIL')
  }

  return email
}

function normalizeResult(
  response: unknown,
  operation: AcademyLicenseOperation,
): AcademyLicenseMutationResult {
  if (
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response)
  ) {
    throw new Error('INVALID_LICENSE_MUTATION_RESPONSE')
  }

  const data = response as Record<string, unknown>
  const alreadyProcessed = operation.kind === 'grant'
    ? data.alreadyGranted
    : data.alreadyRemoved

  if (
    data.academyId !== operation.payload.academyId ||
    !isMembershipIdentifier(data.licenseId) ||
    typeof data.licensesTotal !== 'number' ||
    typeof data.licensesUsed !== 'number' ||
    !Number.isSafeInteger(data.licensesTotal) ||
    !Number.isSafeInteger(data.licensesUsed) ||
    data.licensesTotal < 0 ||
    data.licensesUsed < 0 ||
    data.licensesUsed > data.licensesTotal ||
    typeof alreadyProcessed !== 'boolean'
  ) {
    throw new Error('INVALID_LICENSE_MUTATION_RESPONSE')
  }

  if (
    operation.kind === 'grant' &&
    (
      !/^email_[a-f0-9]{64}$/.test(data.licenseId) ||
      data.licensesUsed === 0
    )
  ) {
    throw new Error('INVALID_LICENSE_MUTATION_RESPONSE')
  }

  if (
    operation.kind === 'revoke' &&
    data.licenseId !== operation.payload.licenseId
  ) {
    throw new Error('INVALID_LICENSE_MUTATION_RESPONSE')
  }

  return Object.freeze({
    academyId: operation.payload.academyId,
    licenseId: data.licenseId,
    licensesTotal: data.licensesTotal,
    licensesUsed: data.licensesUsed,
    alreadyProcessed,
  })
}

export function createAcademyProfessorLicenseCommands({
  getCurrentSession,
  getCurrentAcademy,
  requestOperation,
}: Dependencies) {
  let running = false

  async function execute(
    operation: AcademyLicenseOperation,
    expectedUserId: string,
  ): Promise<AcademyLicenseMutationResult> {
    if (running) {
      throw new Error('LICENSE_OPERATION_RUNNING')
    }

    const academyId = operation.payload.academyId

    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
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

    running = true

    try {
      const response = await requestOperation(operation)
      const currentSession = getCurrentSession()
      const currentAcademy = getCurrentAcademy()

      if (
        currentSession !== initialSession ||
        currentSession?.uid !== expectedUserId
      ) {
        throw new Error('AUTHENTICATION_CHANGED')
      }

      if (
        currentAcademy !== initialAcademy ||
        !currentAcademy ||
        currentAcademy.academyId !== academyId ||
        currentAcademy.userId !== expectedUserId ||
        !canManage(currentAcademy)
      ) {
        throw new Error('ACADEMY_CONTEXT_CHANGED')
      }

      return normalizeResult(response, operation)
    } finally {
      running = false
    }
  }

  return {
    grantLicense(
      academyId: string,
      expectedUserId: string,
      professorEmail: unknown,
    ) {
      return execute({
        kind: 'grant',
        payload: {
          academyId,
          professorEmail: normalizeEmail(professorEmail),
        },
      }, expectedUserId)
    },

    revokeLicense(
      academyId: string,
      expectedUserId: string,
      licenseId: unknown,
    ) {
      if (!isMembershipIdentifier(licenseId)) {
        throw new Error('INVALID_PROFESSOR_LICENSE_ID')
      }

      return execute({
        kind: 'revoke',
        payload: { academyId, licenseId },
      }, expectedUserId)
    },
  }
}