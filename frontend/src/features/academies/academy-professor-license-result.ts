import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'

export interface AcademyProfessorLicense {
  readonly academyId: string
  readonly licenseId: string
  readonly email: string
  readonly status: string
}

export interface AcademyProfessorLicensePage {
  readonly academyId: string
  readonly licensesTotal: number
  readonly licensesUsed: number
  readonly licensesAvailable: number
  readonly licenses: readonly AcademyProfessorLicense[]
  readonly nextCursor: string | null
}

function invalidResponse(): never {
  throw new Error('INVALID_PROFESSOR_LICENSE_RESPONSE')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
}

function isCounter(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
}

function isText(value: unknown, maximum: number): value is string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    return false
  }

  return !Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || (code >= 127 && code <= 159)
  })
}

function normalizeLicense(
  value: unknown,
  academyId: string,
): AcademyProfessorLicense {
  if (
    !isRecord(value) ||
    value.academyId !== academyId ||
    !isMembershipIdentifier(value.licenseId) ||
    !isText(value.email, 254) ||
    !isText(value.status, 80)
  ) {
    return invalidResponse()
  }

  const email = value.email.trim().toLowerCase()
  const separator = email.indexOf('@')

  if (
    /\s/u.test(email) ||
    separator <= 0 ||
    separator !== email.lastIndexOf('@') ||
    separator === email.length - 1
  ) {
    return invalidResponse()
  }

  return Object.freeze({
    academyId,
    licenseId: value.licenseId,
    email,
    status: value.status.trim(),
  })
}

export function normalizeAcademyProfessorLicensePage(
  value: unknown,
  expectedAcademyId: string,
): AcademyProfessorLicensePage {
  if (!isMembershipIdentifier(expectedAcademyId)) {
    throw new Error('INVALID_ACADEMY_ID')
  }

  if (!isRecord(value)) {
    return invalidResponse()
  }

  if (value.academyId !== expectedAcademyId) {
    throw new Error('PROFESSOR_LICENSE_CONTEXT_MISMATCH')
  }

  if (
    !isCounter(value.licensesTotal) ||
    !isCounter(value.licensesUsed) ||
    !isCounter(value.licensesAvailable) ||
    value.licensesUsed > value.licensesTotal ||
    value.licensesAvailable !== value.licensesTotal - value.licensesUsed ||
    !Array.isArray(value.licenses) ||
    value.licenses.length > 20 ||
    (
      value.nextCursor !== null &&
      !isMembershipIdentifier(value.nextCursor)
    )
  ) {
    return invalidResponse()
  }

  const licenses = value.licenses.map((license: unknown) => {
    return normalizeLicense(license, expectedAcademyId)
  })

  for (let index = 1; index < licenses.length; index += 1) {
    if (licenses[index - 1]!.licenseId >= licenses[index]!.licenseId) {
      return invalidResponse()
    }
  }

  if (
    value.nextCursor !== null &&
    (
      licenses.length !== 20 ||
      value.nextCursor !== licenses[19]!.licenseId
    )
  ) {
    return invalidResponse()
  }

  return Object.freeze({
    academyId: expectedAcademyId,
    licensesTotal: value.licensesTotal,
    licensesUsed: value.licensesUsed,
    licensesAvailable: value.licensesAvailable,
    licenses: Object.freeze(licenses),
    nextCursor: value.nextCursor as string | null,
  })
}