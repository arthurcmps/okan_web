import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyStudentsQuery,
} from './academy-students-query'
import type {
  AcademyStudentsRequest,
} from './academy-students-query'

export function createAcademyStudentsService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyStudentsQuery({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestPage: async (request: AcademyStudentsRequest) => {
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

      return callDevFunction<AcademyStudentsRequest, unknown>(
        'listAcademyStudents',
        request,
      )
    },
  })
}