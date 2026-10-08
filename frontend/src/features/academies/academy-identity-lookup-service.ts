import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyIdentityLookupQuery,
} from './academy-identity-lookup-query'
import type {
  AcademyIdentityLookupRequest,
} from './academy-identity-lookup-query'

export function createAcademyIdentityLookupService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyIdentityLookupQuery({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestLookup: async (request: AcademyIdentityLookupRequest) => {
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

      return callDevFunction<AcademyIdentityLookupRequest, unknown>(
        'lookupAcademyAccountByEmail',
        request,
      )
    },
  })
}