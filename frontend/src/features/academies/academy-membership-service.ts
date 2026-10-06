import { FirebaseError } from 'firebase/app'
import { httpsCallable } from 'firebase/functions'

import { getFirebaseClient } from '../../core/firebase/firebase-client'
import { createAcademyMembershipQuery } from './academy-membership-query'
import type { MembershipRequest } from './academy-membership-query'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'

export async function getAcademyMembershipContext(
  academyId: string,
  expectedUserId: string,
): Promise<AcademyMembershipContext | null> {
  const { auth, functions } = getFirebaseClient()

  const queryMembership = createAcademyMembershipQuery({
    getCurrentSession: () => auth.currentUser,

    requestMembership: async (request) => {
      const callable = httpsCallable<MembershipRequest, unknown>(
        functions,
        'getAcademyMembershipContext',
        { timeout: 30000 },
      )

      const response = await callable(request)

      return response.data
    },
  })

  return queryMembership(academyId, expectedUserId)
}

export function getMembershipErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'functions/unauthenticated':
        return 'Sua sessão não foi reconhecida. Saia e entre novamente.'

      case 'functions/permission-denied':
        return 'A consulta foi bloqueada pelo backend.'

      case 'functions/failed-precondition':
        return 'Confira se a consulta de vínculos está habilitada no backend DEV e se o documento possui um contrato válido.'

      case 'functions/invalid-argument':
        return 'O backend rejeitou os dados da consulta.'

      case 'functions/not-found':
        return 'Confira se a callable getAcademyMembershipContext foi carregada no emulador.'

      case 'functions/unavailable':
      case 'functions/deadline-exceeded':
      case 'functions/internal':
        return 'Não foi possível concluir a consulta. Confira os emuladores e os logs do backend.'
    }
  }

  if (error instanceof Error) {
    switch (error.message) {
      case 'INVALID_ACADEMY_ID':
        return 'Informe um identificador de academia válido.'

      case 'AUTHENTICATION_REQUIRED':
      case 'AUTHENTICATION_CHANGED':
        return 'A sessão mudou. Entre novamente antes de consultar.'
    }
  }

  return 'Não foi possível validar o vínculo retornado pelo backend.'
}