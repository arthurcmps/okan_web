import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'
import {
  normalizeAcademyRegistrationInput,
} from './academy-registration-input.ts'
import type {
  AcademyRegistrationInput,
} from './academy-registration-input.ts'
import {
  normalizeAcademyRegistrationResult,
} from './academy-registration-result.ts'

export interface AcademyRegistrationSession {
  readonly uid: string
  readonly email: string | null
}

export interface AcademyRegistrationDependencies {
  getCurrentSession: () => AcademyRegistrationSession | null

  createAccount: (
    email: string,
    password: string,
  ) => Promise<AcademyRegistrationSession>

  registerAcademy: (
    payload: AcademyRegistrationInput,
    session: AcademyRegistrationSession,
  ) => Promise<unknown>

  provisionMembership: (
    payload: Readonly<{ academyId: string }>,
    session: AcademyRegistrationSession,
  ) => Promise<unknown>
}

function normalizeCredentials(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_CREDENTIALS')
  }

  const data = value as Record<string, unknown>

  if (
    typeof data.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+$/.test(data.email.trim()) ||
    typeof data.password !== 'string' ||
    data.password.length < 6 ||
    typeof data.confirmPassword !== 'string' ||
    data.confirmPassword !== data.password
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_CREDENTIALS')
  }

  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
  }
}

function validateProvisioning(
  value: unknown,
  academyId: string,
): string {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_MEMBERSHIP')
  }

  const data = value as Record<string, unknown>

  if (
    data.academyId !== academyId ||
    typeof data.membershipId !== 'string' ||
    !/^membership_[a-f0-9]{64}$/.test(data.membershipId) ||
    typeof data.alreadyProvisioned !== 'boolean'
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_MEMBERSHIP')
  }

  return data.membershipId
}

export function createAcademyRegistrationCommand(
  dependencies: AcademyRegistrationDependencies,
) {
  let running = false

  return async (value: unknown) => {
    if (running) {
      throw new Error('ACADEMY_REGISTRATION_IN_PROGRESS')
    }

    running = true

    try {
      const payload = normalizeAcademyRegistrationInput(value)
      const credentials = normalizeCredentials(value)

      let session = dependencies.getCurrentSession()

      if (session) {
        if (
          session.email?.trim().toLowerCase() !== credentials.email
        ) {
          throw new Error('ACADEMY_REGISTRATION_SESSION_MISMATCH')
        }
      } else {
        session = await dependencies.createAccount(
          credentials.email,
          credentials.password,
        )
      }

      const expectedSession = session
      const expectedUserId = session.uid

      const assertSession = () => {
        const current = dependencies.getCurrentSession()

        if (
          current !== expectedSession ||
          current?.uid !== expectedUserId ||
          !isMembershipIdentifier(expectedUserId) ||
          current?.email?.trim().toLowerCase() !== credentials.email
        ) {
          throw new Error('AUTHENTICATION_CHANGED')
        }
      }

      assertSession()

      const registrationResponse = await dependencies.registerAcademy(
        payload,
        expectedSession,
      )

      assertSession()

      const registration = normalizeAcademyRegistrationResult(
        registrationResponse,
      )

      const membershipResponse = await dependencies.provisionMembership(
        Object.freeze({ academyId: registration.academyId }),
        expectedSession,
      )

      assertSession()

      const membershipId = validateProvisioning(
        membershipResponse,
        registration.academyId,
      )

      return Object.freeze({
        academyId: registration.academyId,
        alreadyRegistered: registration.alreadyRegistered,
        membershipId,
      })
    } finally {
      running = false
    }
  }
}