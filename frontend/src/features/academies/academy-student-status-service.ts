import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'

import type {
  AcademyMembershipContext,
} from './academy-membership-context'

import {
  createAcademyStudentStatusCommand,
} from './academy-student-status-command'

import type {
  AcademyStudentStatusRequest,
} from './academy-student-status-command'

export function createAcademyStudentStatusService(
  getCurrentAcademy: () => AcademyMembershipContext | null,
) {
  const { auth } = getFirebaseClient()

  return createAcademyStudentStatusCommand({
    getCurrentSession: () => auth.currentUser,
    getCurrentAcademy,

    requestChange: async (request: AcademyStudentStatusRequest) => {
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

      return callDevFunction<AcademyStudentStatusRequest, unknown>(
        'changeAcademyStudentStatus',
        request,
      )
    },
  })
}