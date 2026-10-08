import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyProfileQuery,
} from './academy-profile-query'
import type {
  AcademyProfileQueryPayload,
} from './academy-profile-query'

export function createAcademyProfileQueryService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyProfileQuery({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestProfile: async (payload: AcademyProfileQueryPayload) => {
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

      return callDevFunction<AcademyProfileQueryPayload, unknown>(
        'getAcademyProfile',
        payload,
      )
    },
  })
}