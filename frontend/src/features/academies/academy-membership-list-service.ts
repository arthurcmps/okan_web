import {
  getFirebaseClient,
} from '../../core/firebase/firebase-client'
import {
  createAcademyMembershipListQuery,
} from './academy-membership-list-query'
import type {
  MembershipListRequest,
} from './academy-membership-list-query'
import type {
  AcademyMembershipPage,
} from './academy-membership-list'

export async function listMyAcademyMemberships(
  expectedUserId: string,
  cursor: string | null = null,
): Promise<AcademyMembershipPage> {
  const { auth } = getFirebaseClient()
  const initialSession = auth.currentUser

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => auth.currentUser,

    requestPage: async (request: MembershipListRequest) => {
      const { callDevFunction } = await import(
        '../../core/firebase/functions-client'
      )

      if (
        auth.currentUser !== initialSession ||
        auth.currentUser?.uid !== expectedUserId
      ) {
        throw new Error('AUTHENTICATION_CHANGED')
      }

      return callDevFunction<MembershipListRequest, unknown>(
        'listMyAcademyMemberships',
        request,
      )
    },
  })

  return query(expectedUserId, cursor)
}