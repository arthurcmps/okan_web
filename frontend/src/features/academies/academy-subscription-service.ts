import { getFirebaseClient } from '../../core/firebase/firebase-client'
import type { AcademyMembershipContext } from './academy-membership-context'
import { createAcademySubscriptionQueries } from './academy-subscription-query'

export function createAcademySubscriptionService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademySubscriptionQueries({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    request: async (payload) => {
      const session = auth.currentUser
      const academy = getCurrentAcademy()

      const { callDevFunction } = await import(
        '../../core/firebase/functions-client'
      )

      if (
        auth.currentUser !== session ||
        auth.currentUser?.uid !== session?.uid
      ) {
        throw new Error('AUTHENTICATION_CHANGED')
      }

      if (getCurrentAcademy() !== academy) {
        throw new Error('ACADEMY_CONTEXT_CHANGED')
      }

      return callDevFunction<typeof payload, unknown>(
        'licenseQuantity' in payload
          ? 'quoteAcademySubscriptionPanel'
          : 'getAcademySubscriptionPanel',
        payload,
      )
    },
  })
}