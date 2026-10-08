import {
  createUserWithEmailAndPassword,
} from 'firebase/auth'

import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import {
  createAcademyRegistrationCommand,
} from './academy-registration-command'
import type {
  AcademyRegistrationSession,
} from './academy-registration-command'

export function createAcademyRegistrationService() {
  const { auth } = getFirebaseClient()

  async function send<T extends object>(
    functionName: string,
    payload: T,
    expectedSession: AcademyRegistrationSession,
  ): Promise<unknown> {
    const { callDevFunction } = await import(
      '../../core/firebase/functions-client'
    )

    if (
      auth.currentUser !== expectedSession ||
      auth.currentUser?.uid !== expectedSession.uid
    ) {
      throw new Error('AUTHENTICATION_CHANGED')
    }

    return callDevFunction<T, unknown>(functionName, payload)
  }

  return createAcademyRegistrationCommand({
    getCurrentSession: () => auth.currentUser,

    createAccount: async (email, password) => {
      if (auth.currentUser) {
        throw new Error('AUTHENTICATION_CHANGED')
      }

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      )

      return credential.user
    },

    registerAcademy: (payload, session) => send(
      'registerAcademy',
      payload,
      session,
    ),

    provisionMembership: (payload, session) => send(
      'bootstrapAcademyManagerMembership',
      payload,
      session,
    ),
  })
}