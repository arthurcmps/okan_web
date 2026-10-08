import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'

export interface AcademyProfileFields {
  readonly nome: string
  readonly cnpj: string
  readonly telefoneResponsavel: string
  readonly cep: string
  readonly endereco: string
  readonly bairro: string
  readonly uf: string
}

export interface AcademyProfile extends AcademyProfileFields {
  readonly academyId: string
  readonly emailGestor: string
}

export interface AcademyProfileResult {
  readonly academy: AcademyProfile
  readonly revision: number
}

export interface AcademyProfileUpdateResult extends AcademyProfileResult {
  readonly updated: boolean
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function profileText(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value !== value.trim()
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_RESPONSE')
  }

  return value
}

export function normalizeAcademyProfileResult(
  value: unknown,
  expectedAcademyId: string,
): AcademyProfileResult {
  if (!isMembershipIdentifier(expectedAcademyId)) {
    throw new Error('INVALID_ACADEMY_PROFILE_CONTEXT')
  }

  if (
    !isRecord(value) ||
    !isRecord(value.academy) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_RESPONSE')
  }

  const data = value.academy

  if (data.academyId !== expectedAcademyId) {
    throw new Error('ACADEMY_PROFILE_CONTEXT_MISMATCH')
  }

  const nome = profileText(data.nome)

  if (
    nome.length === 0 ||
    nome.length > 200 ||
    Array.from(nome).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_RESPONSE')
  }

  const academy: AcademyProfile = Object.freeze({
    academyId: expectedAcademyId,
    nome,
    cnpj: profileText(data.cnpj),
    telefoneResponsavel: profileText(data.telefoneResponsavel),
    cep: profileText(data.cep),
    endereco: profileText(data.endereco),
    bairro: profileText(data.bairro),
    uf: profileText(data.uf),
    emailGestor: profileText(data.emailGestor),
  })

  return Object.freeze({
    academy,
    revision: value.revision,
  })
}

export function normalizeAcademyProfileUpdateResult(
  value: unknown,
  expectedAcademyId: string,
): AcademyProfileUpdateResult {
  const result = normalizeAcademyProfileResult(
    value,
    expectedAcademyId,
  )

  if (
    !isRecord(value) ||
    typeof value.updated !== 'boolean' ||
    (value.updated && result.revision === 0)
  ) {
    throw new Error('INVALID_ACADEMY_PROFILE_UPDATE_RESPONSE')
  }

  return Object.freeze({
    ...result,
    updated: value.updated,
  })
}