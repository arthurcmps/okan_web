export interface AcademyRegistrationInput {
  readonly gymName: string
  readonly adminName: string
  readonly cnpj: string
  readonly telefone: string
  readonly cep: string
  readonly endereco: string
  readonly bairro: string
  readonly uf: string
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('INVALID_ACADEMY_REGISTRATION_INPUT')
  }

  return value.trim()
}

export function normalizeAcademyRegistrationInput(
  value: unknown,
): AcademyRegistrationInput {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_INPUT')
  }

  const data = value as Record<string, unknown>

  const gymName = requiredText(data.gymName)
  const adminName = requiredText(data.adminName)
  const cnpj = requiredText(data.cnpj)
  const telefone = requiredText(data.telefone)
  const cep = requiredText(data.cep)
  const endereco = requiredText(data.endereco)
  const bairro = requiredText(data.bairro)
  const uf = requiredText(data.uf).toUpperCase()

  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new Error('INVALID_ACADEMY_REGISTRATION_INPUT')
  }

  return Object.freeze({
    gymName,
    adminName,
    cnpj,
    telefone,
    cep,
    endereco,
    bairro,
    uf,
  })
}