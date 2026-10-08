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
  normalizeAcademyProfileUpdateResult,
} from './academy-profile-result.ts'
import type {
  AcademyProfileFields,
  AcademyProfileUpdateResult,
} from './academy-profile-result.ts'

const EDITABLE_FIELDS = [
  'nome',
  'cnpj',
  'telefoneResponsavel',
  'cep',
  'endereco',
  'bairro',
  'uf',
] as const

export interface AcademyProfileUpdatePayload {
  readonly academyId: string
  readonly fields: AcademyProfileFields
  readonly expectedRevision: number
}

interface CommandDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  requestUpdate: (
    payload: AcademyProfileUpdatePayload,
  ) => Promise<unknown>
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('INVALID_ACADEMY_PROFILE_FIELDS')
  }

  return value.trim()
}

export function normalizeAcademyProfileFields(
  value: unknown,
): AcademyProfileFields {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_FIELDS')
  }

  const data = value as Record<string, unknown>

  if (
    Object.keys(data).length !== EDITABLE_FIELDS.length ||
    !EDITABLE_FIELDS.every((field) => Object.hasOwn(data, field))
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_FIELDS')
  }

  const fields: AcademyProfileFields = {
    nome: requiredText(data.nome),
    cnpj: requiredText(data.cnpj),
    telefoneResponsavel: requiredText(data.telefoneResponsavel),
    cep: requiredText(data.cep),
    endereco: requiredText(data.endereco),
    bairro: requiredText(data.bairro),
    uf: requiredText(data.uf).toUpperCase(),
  }

  if (
    fields.nome.length > 200 ||
    Array.from(fields.nome).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    }) ||
    !/^[A-Z]{2}$/.test(fields.uf)
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_FIELDS')
  }

  return Object.freeze(fields)
}

function canManage(academy: AcademyMembershipContext): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

export function createAcademyProfileUpdateCommand({
  getCurrentSession,
  getCurrentAcademy,
  requestUpdate,
}: CommandDependencies) {
  return async function updateProfile(
    academyId: string,
    expectedUserId: string,
    fields: unknown,
    expectedRevision: number,
  ): Promise<AcademyProfileUpdateResult> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    ) {
      throw new Error('INVALID_ACADEMY_PROFILE_REVISION')
    }

    const normalizedFields = normalizeAcademyProfileFields(fields)
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

    const response = await requestUpdate({
      academyId,
      fields: normalizedFields,
      expectedRevision,
    })

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

    const result = normalizeAcademyProfileUpdateResult(
      response,
      academyId,
    )

    if (
      EDITABLE_FIELDS.some((field) => {
        return result.academy[field] !== normalizedFields[field]
      }) ||
      (
        result.updated
          ? result.revision !== expectedRevision + 1
          : result.revision < expectedRevision
      )
    ) {
      throw new Error('ACADEMY_PROFILE_UPDATE_CONFIRMATION_MISMATCH')
    }

    return result
  }
}