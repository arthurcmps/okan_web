import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'

export type AcademySentLinkRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'

export interface AcademySentLinkRequest {
  readonly requestId: string
  readonly academyId: string
  readonly status: AcademySentLinkRequestStatus
  readonly createdAtMs: number
  readonly expiresAtMs: number
  readonly respondedAtMs: number | null
}

export interface AcademySentLinkRequestPage {
  readonly requests: readonly AcademySentLinkRequest[]
  readonly nextCursor: string | null
}

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{16,80}$/

function invalidResponse(): never {
  throw new Error('INVALID_SENT_LINK_REQUEST_RESPONSE')
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' &&
    value === value.trim() &&
    REQUEST_ID_PATTERN.test(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
}

function isStatus(
  value: unknown,
): value is AcademySentLinkRequestStatus {
  return value === 'pending' ||
    value === 'accepted' ||
    value === 'rejected' ||
    value === 'expired' ||
    value === 'cancelled'
}

function normalizeRequest(value: unknown): AcademySentLinkRequest {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return invalidResponse()
  }

  const data = value as Record<string, unknown>

  if (
    !isRequestId(data.requestId) ||
    !isMembershipIdentifier(data.academyId) ||
    !isStatus(data.status) ||
    !isTimestamp(data.createdAtMs) ||
    !isTimestamp(data.expiresAtMs) ||
    data.expiresAtMs <= data.createdAtMs
  ) {
    return invalidResponse()
  }

  const hasResponse = data.status === 'accepted' ||
    data.status === 'rejected' ||
    data.status === 'cancelled'

  if (hasResponse) {
    if (
      !isTimestamp(data.respondedAtMs) ||
      data.respondedAtMs < data.createdAtMs ||
      data.respondedAtMs >= data.expiresAtMs
    ) {
      return invalidResponse()
    }
  } else if (data.respondedAtMs !== null) {
    return invalidResponse()
  }

  return Object.freeze({
    requestId: data.requestId,
    academyId: data.academyId,
    status: data.status,
    createdAtMs: data.createdAtMs,
    expiresAtMs: data.expiresAtMs,
    respondedAtMs: data.respondedAtMs as number | null,
  })
}

export function normalizeAcademySentLinkRequestPage(
  value: unknown,
): AcademySentLinkRequestPage {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return invalidResponse()
  }

  const data = value as Record<string, unknown>

  if (
    !Array.isArray(data.requests) ||
    data.requests.length > 20 ||
    (
      data.nextCursor !== null &&
      !isRequestId(data.nextCursor)
    )
  ) {
    return invalidResponse()
  }

  const requests = data.requests.map(normalizeRequest)

  for (let index = 1; index < requests.length; index += 1) {
    if (
      requests[index - 1]!.requestId >= requests[index]!.requestId
    ) {
      return invalidResponse()
    }
  }

  if (
    data.nextCursor !== null &&
    (
      requests.length !== 20 ||
      data.nextCursor !== requests[19]!.requestId
    )
  ) {
    return invalidResponse()
  }

  return Object.freeze({
    requests: Object.freeze(requests),
    nextCursor: data.nextCursor as string | null,
  })
}