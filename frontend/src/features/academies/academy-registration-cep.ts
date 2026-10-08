export interface RegistrationAddress {
  readonly logradouro: string
  readonly bairro: string
  readonly uf: string
}

export async function lookupRegistrationCep(
  value: string,
  signal: AbortSignal,
): Promise<RegistrationAddress> {
  const formattedCep = value.trim()

  if (!/^\d{5}-?\d{3}$/.test(formattedCep)) {
    throw new Error('INVALID_REGISTRATION_CEP')
  }

  const cep = formattedCep.replace('-', '')

  const response = await fetch(
    `https://viacep.com.br/ws/${cep}/json/`,
    { signal },
  )

  if (!response.ok) {
    throw new Error('REGISTRATION_CEP_REQUEST_FAILED')
  }

  const valueReturned: unknown = await response.json()

  if (
    !valueReturned ||
    typeof valueReturned !== 'object' ||
    Array.isArray(valueReturned)
  ) {
    throw new Error('INVALID_REGISTRATION_CEP_RESPONSE')
  }

  const data = valueReturned as Record<string, unknown>

  if (data.erro === true || data.erro === 'true') {
    throw new Error('REGISTRATION_CEP_NOT_FOUND')
  }

  if (
    typeof data.cep !== 'string' ||
    data.cep.replace('-', '') !== cep ||
    typeof data.logradouro !== 'string' ||
    typeof data.bairro !== 'string' ||
    typeof data.uf !== 'string' ||
    !/^[A-Z]{2}$/.test(data.uf)
  ) {
    throw new Error('INVALID_REGISTRATION_CEP_RESPONSE')
  }

  return Object.freeze({
    logradouro: data.logradouro.trim(),
    bairro: data.bairro.trim(),
    uf: data.uf,
  })
}