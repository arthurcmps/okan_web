import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyLinkRequestCommand,
} from './academy-link-request-command'
import type {
  AcademyLinkRequestPayload,
} from './academy-link-request-command'

export function createAcademyLinkRequestService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyLinkRequestCommand({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    sendRequest: async (payload: AcademyLinkRequestPayload) => {
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

      return callDevFunction<AcademyLinkRequestPayload, unknown>(
        'requestStudentLink',
        payload,
      )
    },
  })
}