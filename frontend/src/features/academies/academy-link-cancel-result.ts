import {
  isMembershipIdentifier,
} from './academy-membership-context.ts'

export interface AcademyLinkCancelResult {
  readonly requestId: string
  readonly academyId: string
  readonly status: 'cancelled'
  readonly alreadyProcessed: boolean
}

export function normalizeAcademyLinkCancelResult(
  value: unknown,
): AcademyLinkCancelResult {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error('INVALID_ACADEMY_LINK_CANCEL_RESPONSE')
  }

  const data = value as Record<string, unknown>

  if (
    typeof data.requestId !== 'string' ||
    data.requestId !== data.requestId.trim() ||
    !/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId) ||
    !isMembershipIdentifier(data.academyId) ||
    data.status !== 'cancelled' ||
    typeof data.alreadyProcessed !== 'boolean'
  ) {
    throw new Error('INVALID_ACADEMY_LINK_CANCEL_RESPONSE')
  }

  return Object.freeze({
    requestId: data.requestId,
    academyId: data.academyId,
    status: 'cancelled',
    alreadyProcessed: data.alreadyProcessed,
  })
}