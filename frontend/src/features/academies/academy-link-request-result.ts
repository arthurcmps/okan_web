export interface AcademyLinkRequestResult {
  readonly requestId: string
  readonly expiresAtMs: number
}

export function normalizeAcademyLinkRequestResult(
  response: unknown,
): AcademyLinkRequestResult {
  if (
    typeof response !== 'object' ||
    response === null ||
    Array.isArray(response)
  ) {
    throw new Error('INVALID_ACADEMY_LINK_REQUEST_RESPONSE')
  }

  const data = response as Record<string, unknown>

  if (
    typeof data.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId) ||
    typeof data.expiresAtMs !== 'number' ||
    !Number.isSafeInteger(data.expiresAtMs) ||
    data.expiresAtMs < 0
  ) {
    throw new Error('INVALID_ACADEMY_LINK_REQUEST_RESPONSE')
  }

  return Object.freeze({
    requestId: data.requestId,
    expiresAtMs: data.expiresAtMs,
  })
}