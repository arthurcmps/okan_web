import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademySentLinkRequestQuery,
} from './academy-sent-link-request-query'
import type {
  AcademySentLinkRequestQueryPayload,
} from './academy-sent-link-request-query'

export function createAcademySentLinkRequestService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademySentLinkRequestQuery({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestPage: async (
      payload: AcademySentLinkRequestQueryPayload,
    ) => {
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

      return callDevFunction<
        AcademySentLinkRequestQueryPayload,
        unknown
      >(
        'listMySentAcademyLinkRequests',
        payload,
      )
    },
  })
}