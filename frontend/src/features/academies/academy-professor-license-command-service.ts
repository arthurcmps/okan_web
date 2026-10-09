import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import {
  createAcademyProfessorLicenseCommands,
} from './academy-professor-license-command'

export function createAcademyProfessorLicenseCommandService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyProfessorLicenseCommands({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestOperation: async (operation) => {
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

      const name = operation.kind === 'grant'
        ? 'grantAcademyLicense'
        : 'revokeAcademyLicense'

      return callDevFunction<typeof operation.payload, unknown>(
        name,
        operation.payload,
      )
    },
  })
}