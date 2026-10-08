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
  normalizeAcademyLinkCancelResult,
} from './academy-link-cancel-result.ts'
import type {
  AcademyLinkCancelResult,
} from './academy-link-cancel-result.ts'

export interface AcademyLinkCancelPayload {
  readonly requestId: string
}

interface CommandDependencies {
  getCurrentSession: () => MembershipSession | null
  getCurrentAcademy: () => AcademyMembershipContext | null
  sendCancel: (payload: AcademyLinkCancelPayload) => Promise<unknown>
}

function canManage(
  academy: AcademyMembershipContext,
): boolean {
  return academy.status === 'active' &&
    academy.canManage &&
    academy.roles.includes('gym_admin')
}

export function createAcademyLinkCancelCommand({
  getCurrentSession,
  getCurrentAcademy,
  sendCancel,
}: CommandDependencies) {
  return async function cancelRequest(
    academyId: string,
    expectedUserId: string,
    requestId: string,
  ): Promise<AcademyLinkCancelResult> {
    if (!isMembershipIdentifier(academyId)) {
      throw new Error('INVALID_ACADEMY_ID')
    }

    if (!isMembershipIdentifier(expectedUserId)) {
      throw new Error('INVALID_MEMBERSHIP_CONTEXT')
    }

    if (
      typeof requestId !== 'string' ||
      requestId !== requestId.trim() ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)
    ) {
      throw new Error('INVALID_ACADEMY_LINK_REQUEST_ID')
    }

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

    const response = await sendCancel({ requestId })

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

    const result = normalizeAcademyLinkCancelResult(response)

    if (
      result.requestId !== requestId ||
      result.academyId !== academyId
    ) {
      throw new Error('ACADEMY_LINK_CANCEL_CONTEXT_MISMATCH')
    }

    return result
  }
}