import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyMembershipQuery,
} from '../src/features/academies/academy-membership-query.ts'
import type {
  MembershipRequest,
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const academyId = 'academia-dev'
const userId = 'gestor-dev'

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    membership: {
      membershipId: `membership_${'a'.repeat(64)}`,
      schemaVersion: 1,
      academyId,
      userId,
      roles: ['gym_admin'],
      status: 'active',
      canManage: true,
      ...overrides,
    },
  }
}

test('envia somente academyId e retorna contexto validado', async () => {
  const session = { uid: userId }
  const requests: MembershipRequest[] = []

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => session,
    requestMembership: async (request) => {
      requests.push(request)
      return validResponse({ privateNote: 'Campo interno' })
    },
  })

  const result = await query(academyId, userId)

  assert.deepEqual(requests, [{ academyId }])
  assert.ok(result)
  assert.equal(result.userId, userId)
  assert.equal(result.canManage, true)
  assert.equal(Object.hasOwn(result, 'privateNote'), false)
})

test('preserva resposta explícita de vínculo ausente', async () => {
  const session = { uid: userId }

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => session,
    requestMembership: async () => ({ membership: null }),
  })

  assert.equal(await query(academyId, userId), null)
})

test('sem sessão não consulta o backend', async () => {
  let calls = 0

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => null,
    requestMembership: async () => {
      calls += 1
      return validResponse()
    },
  })

  await assert.rejects(
    query(academyId, userId),
    /AUTHENTICATION_REQUIRED/,
  )

  assert.equal(calls, 0)
})

test('sessão divergente não consulta o backend', async () => {
  let calls = 0

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => ({ uid: 'outro-usuario' }),
    requestMembership: async () => {
      calls += 1
      return validResponse()
    },
  })

  await assert.rejects(
    query(academyId, userId),
    /AUTHENTICATION_CHANGED/,
  )

  assert.equal(calls, 0)
})

test('academia inválida não consulta o backend', async () => {
  const session = { uid: userId }
  let calls = 0

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => session,
    requestMembership: async () => {
      calls += 1
      return validResponse()
    },
  })

  for (const invalidId of ['', ' academia ', 'a/b', '.', '..']) {
    await assert.rejects(
      query(invalidId, userId),
      /INVALID_ACADEMY_ID/,
    )
  }

  assert.equal(calls, 0)
})

test('rejeita respostas inválidas ou de outro contexto', async () => {
  const session = { uid: userId }

  const responses = [
    {},
    null,
    validResponse({ userId: 'outro-usuario' }),
    validResponse({ academyId: 'outra-academia' }),
    validResponse({ schemaVersion: 2 }),
    validResponse({ roles: ['aluno'], canManage: true }),
  ]

  for (const response of responses) {
    const query = createAcademyMembershipQuery({
      getCurrentSession: () => session,
      requestMembership: async () => response,
    })

    await assert.rejects(query(academyId, userId))
  }
})

test('preserva o erro original da chamada ao backend', async () => {
  const session = { uid: userId }
  const failure = new Error('Falha simulada do backend')

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => session,
    requestMembership: async () => {
      throw failure
    },
  })

  await assert.rejects(
    query(academyId, userId),
    (error: unknown) => error === failure,
  )
})

function createPendingQuery() {
  const state: { session: MembershipSession | null } = {
    session: { uid: userId },
  }

  let complete: (response: unknown) => void = () => {
    throw new Error('Requisição ainda não preparada')
  }

  const response = new Promise<unknown>((resolve) => {
    complete = resolve
  })

  const query = createAcademyMembershipQuery({
    getCurrentSession: () => state.session,
    requestMembership: () => response,
  })

  return {
    state,
    query,
    complete,
  }
}

test('descarta resposta recebida depois do logout', async () => {
  const pending = createPendingQuery()
  const result = pending.query(academyId, userId)

  pending.state.session = null
  pending.complete(validResponse())

  await assert.rejects(result, /AUTHENTICATION_CHANGED/)
})

test('descarta resposta depois de trocar de conta', async () => {
  const pending = createPendingQuery()
  const result = pending.query(academyId, userId)

  pending.state.session = { uid: 'outro-usuario' }
  pending.complete(validResponse())

  await assert.rejects(result, /AUTHENTICATION_CHANGED/)
})

test('nova sessão com mesmo UID invalida consulta anterior', async () => {
  const pending = createPendingQuery()
  const result = pending.query(academyId, userId)

  pending.state.session = { uid: userId }
  pending.complete(validResponse())

  await assert.rejects(result, /AUTHENTICATION_CHANGED/)
})