import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyProfessorLicenseQuery,
} from './academy-professor-license-query'
import type {
  AcademyProfessorLicenseQueryPayload,
} from './academy-professor-license-query'

export function createAcademyProfessorLicenseQueryService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyProfessorLicenseQuery({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestLicenses: async (payload: AcademyProfessorLicenseQueryPayload) => {
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

      return callDevFunction<AcademyProfessorLicenseQueryPayload, unknown>(
        'listAcademyProfessorLicenses',
        payload,
      )
    },
  })
}