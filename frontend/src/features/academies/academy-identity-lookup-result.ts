export interface AcademyIdentityLookupTicket {
  readonly ticketId: string
  readonly expiresAtMs: number
}

export function normalizeAcademyIdentityLookupResult(
  response: unknown,
): AcademyIdentityLookupTicket | null {
  if (response === null) {
    return null
  }

  if (
    typeof response !== 'object' ||
    response === null ||
    Array.isArray(response)
  ) {
    throw new Error('INVALID_IDENTITY_LOOKUP_RESPONSE')
  }

  const data = response as Record<string, unknown>

  if (
    typeof data.ticketId !== 'string' ||
    !/^lookup_[a-f0-9]{64}$/.test(data.ticketId) ||
    typeof data.expiresAtMs !== 'number' ||
    !Number.isSafeInteger(data.expiresAtMs) ||
    data.expiresAtMs < 0
  ) {
    throw new Error('INVALID_IDENTITY_LOOKUP_RESPONSE')
  }

  return Object.freeze({
    ticketId: data.ticketId,
    expiresAtMs: data.expiresAtMs,
  })
}