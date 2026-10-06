import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyMembershipListQuery,
} from '../src/features/academies/academy-membership-list-query.ts'
import type {
  MembershipListRequest,
} from '../src/features/academies/academy-membership-list-query.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const USER_ID = 'usuario-dev'

function membershipId(index: number): string {
  return `membership_${index.toString(16).padStart(64, '0')}`
}

function createPage(index = 1) {
  return {
    memberships: [{
      membershipId: membershipId(index),
      schemaVersion: 1,
      academyId: `academia-${index}`,
      userId: USER_ID,
      roles: ['aluno'],
      status: 'active',
      canManage: false,
    }],
    nextCursor: null,
  }
}

test('envia somente o cursor e valida a página recebida', async () => {
  const session = { uid: USER_ID }
  const requests: MembershipListRequest[] = []

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => session,
    requestPage: async (request) => {
      requests.push(request)
      return createPage(request.cursor ? 21 : 1)
    },
  })

  const first = await query(USER_ID)
  const next = await query(USER_ID, membershipId(20))

  assert.deepEqual(requests, [
    {},
    { cursor: membershipId(20) },
  ])

  assert.equal(first.memberships[0]?.userId, USER_ID)
  assert.equal(next.memberships[0]?.membershipId, membershipId(21))
})

test('preserva página vazia explícita', async () => {
  const session = { uid: USER_ID }

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => session,
    requestPage: async () => ({
      memberships: [],
      nextCursor: null,
    }),
  })

  assert.deepEqual(await query(USER_ID), {
    memberships: [],
    nextCursor: null,
  })
})

test('sem sessão não consulta o backend', async () => {
  let calls = 0

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => null,
    requestPage: async () => {
      calls += 1
      return createPage()
    },
  })

  await assert.rejects(query(USER_ID), {
    message: 'AUTHENTICATION_REQUIRED',
  })

  assert.equal(calls, 0)
})

test('usuário inválido ou sessão divergente não consulta', async () => {
  let calls = 0
  const session = { uid: 'outra-conta' }

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => session,
    requestPage: async () => {
      calls += 1
      return createPage()
    },
  })

  await assert.rejects(query(' usuario-dev '), {
    message: 'INVALID_MEMBERSHIP_CONTEXT',
  })

  await assert.rejects(query(USER_ID), {
    message: 'AUTHENTICATION_CHANGED',
  })

  assert.equal(calls, 0)
})

test('cursor inválido não consulta o backend', async () => {
  let calls = 0
  const session = { uid: USER_ID }

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => session,
    requestPage: async () => {
      calls += 1
      return createPage()
    },
  })

  await assert.rejects(query(USER_ID, 'invalid'), {
    message: 'INVALID_MEMBERSHIP_CURSOR',
  })

  assert.equal(calls, 0)
})

test('rejeita resposta inválida ou pertencente a outra conta', async () => {
  const session = { uid: USER_ID }
  const foreignPage = createPage()
  foreignPage.memberships[0]!.userId = 'outra-conta'

  for (const response of [null, {}, foreignPage]) {
    const query = createAcademyMembershipListQuery({
      getCurrentSession: () => session,
      requestPage: async () => response,
    })

    await assert.rejects(query(USER_ID))
  }
})

test('preserva o erro original da chamada ao backend', async () => {
  const session = { uid: USER_ID }
  const originalError = new Error('backend indisponível')

  const query = createAcademyMembershipListQuery({
    getCurrentSession: () => session,
    requestPage: async () => {
      throw originalError
    },
  })

  await assert.rejects(
    query(USER_ID),
    (error: unknown) => error === originalError,
  )
})

test('descarta resposta após logout ou substituição da sessão', async () => {
  const replacements: (MembershipSession | null)[] = [
    null,
    { uid: 'outra-conta' },
    { uid: USER_ID },
  ]

  for (const replacement of replacements) {
    let session: MembershipSession | null = { uid: USER_ID }
    let resolveResponse!: (response: unknown) => void

    const pendingResponse = new Promise<unknown>((resolve) => {
      resolveResponse = resolve
    })

    const query = createAcademyMembershipListQuery({
      getCurrentSession: () => session,
      requestPage: () => pendingResponse,
    })

    const pendingQuery = query(USER_ID)

    const rejection = assert.rejects(pendingQuery, {
      message: 'AUTHENTICATION_CHANGED',
    })

    session = replacement
    resolveResponse(createPage())

    await rejection
  }
})