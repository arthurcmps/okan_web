import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyLinkCancelCommand,
} from './academy-link-cancel-command'
import type {
  AcademyLinkCancelPayload,
} from './academy-link-cancel-command'

export function createAcademyLinkCancelService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyLinkCancelCommand({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    sendCancel: async (payload: AcademyLinkCancelPayload) => {
      const initialSession = auth.currentUser
      const initialAcademy = getCurrentAcademy()

      const { callDevFunction } = await import(
        '../../core/firebase/functions-client'
      )

      if (
        auth.currentUser !== initialSession ||
        auth.currentUser?.uid !== initialSession?.uid
      ) {
        throw new Error('AUTHENTICATION_CHANGED')
      }

      if (getCurrentAcademy() !== initialAcademy) {
        throw new Error('ACADEMY_CONTEXT_CHANGED')
      }

      return callDevFunction<AcademyLinkCancelPayload, unknown>(
        'cancelStudentLink',
        payload,
      )
    },
  })
}