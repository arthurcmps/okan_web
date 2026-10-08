import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'

export interface AcademyRegistrationResult {
  readonly academyId: string
  readonly alreadyRegistered: boolean
}

export function normalizeAcademyRegistrationResult(
  value: unknown,
): AcademyRegistrationResult {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_RESPONSE')
  }

  const data = value as Record<string, unknown>

  if (
    !isMembershipIdentifier(data.academyId) ||
    typeof data.alreadyRegistered !== 'boolean'
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_RESPONSE')
  }

  return Object.freeze({
    academyId: data.academyId,
    alreadyRegistered: data.alreadyRegistered,
  })
}