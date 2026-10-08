import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyProfileUpdateCommand,
} from './academy-profile-update-command'
import type {
  AcademyProfileUpdatePayload,
} from './academy-profile-update-command'

export function createAcademyProfileUpdateService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyProfileUpdateCommand({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestUpdate: async (payload: AcademyProfileUpdatePayload) => {
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

      return callDevFunction<AcademyProfileUpdatePayload, unknown>(
        'updateAcademyProfile',
        payload,
      )
    },
  })
}