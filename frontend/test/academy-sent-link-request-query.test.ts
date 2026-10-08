import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademySentLinkRequestQuery,
} from '../src/features/academies/academy-sent-link-request-query.ts'
import type {
  AcademySentLinkRequestQueryPayload,
} from '../src/features/academies/academy-sent-link-request-query.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

function createPage() {
  return {
    requests: [{
      requestId: 'request_student_123456',
      academyId: 'academy-dev',
      status: 'pending',
      createdAtMs: 1000,
      expiresAtMs: 5000,
      respondedAtMs: null,
    }],
    nextCursor: null,
  }
}

function createFixture() {
  let session: MembershipSession | null = { uid: 'manager-dev' }

  let academy: AcademyMembershipContext | null = {
    membershipId: `membership_${'a'.repeat(64)}`,
    schemaVersion: 1,
    academyId: 'academy-dev',
    userId: 'manager-dev',
    roles: ['gym_admin'],
    status: 'active',
    canManage: true,
  }

  let response: unknown = createPage()
  let onRequest: () => void = () => {}

  const payloads: AcademySentLinkRequestQueryPayload[] = []

  const query = createAcademySentLinkRequestQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestPage: async (payload) => {
      payloads.push(payload)
      onRequest()
      return response
    },
  })

  return {
    query,
    payloads,
    getAcademy: () => academy,
    setSession: (value: MembershipSession | null) => {
      session = value
    },
    setAcademy: (value: AcademyMembershipContext | null) => {
      academy = value
    },
    setResponse: (value: unknown) => {
      response = value
    },
    setOnRequest: (value: () => void) => {
      onRequest = value
    },
  }
}

test('envia somente academia e cursor e valida a pagina', async () => {
  const fixture = createFixture()

  const result = await fixture.query(
    'academy-dev',
    'manager-dev',
    'request_student_123455',
  )

  assert.deepEqual(fixture.payloads, [{
    academyId: 'academy-dev',
    cursor: 'request_student_123455',
  }])

  assert.deepEqual(result, createPage())
})

test('primeira consulta usa cursor nulo e aceita pagina vazia', async () => {
  const fixture = createFixture()
  fixture.setResponse({ requests: [], nextCursor: null })

  const result = await fixture.query('academy-dev', 'manager-dev')

  assert.deepEqual(result, { requests: [], nextCursor: null })
  assert.deepEqual(fixture.payloads, [{
    academyId: 'academy-dev',
    cursor: null,
  }])
})

test('sessao ausente ou diferente bloqueia antes da chamada', async () => {
  for (const session of [null, { uid: 'other-user' }]) {
    const fixture = createFixture()
    fixture.setSession(session)

    await assert.rejects(
      fixture.query('academy-dev', 'manager-dev'),
      /AUTHENTICATION_/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('academia ausente diferente ou sem permissao bloqueia', async () => {
  const source = createFixture().getAcademy()!

  const cases: (AcademyMembershipContext | null)[] = [
    null,
    { ...source, academyId: 'other-academy' },
    { ...source, userId: 'other-user' },
    { ...source, status: 'suspended' },
    { ...source, canManage: false },
    { ...source, roles: ['aluno'] },
  ]

  for (const academy of cases) {
    const fixture = createFixture()
    fixture.setAcademy(academy)

    await assert.rejects(
      fixture.query('academy-dev', 'manager-dev'),
      /ACADEMY_/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('troca de sessao durante consulta descarta resultado', async () => {
  const fixture = createFixture()

  fixture.setOnRequest(() => {
    fixture.setSession({ uid: 'manager-dev' })
  })

  await assert.rejects(
    fixture.query('academy-dev', 'manager-dev'),
    /AUTHENTICATION_CHANGED/,
  )

  assert.equal(fixture.payloads.length, 1)
})

test('troca de academia durante consulta descarta resultado', async () => {
  const fixture = createFixture()
  const initial = fixture.getAcademy()!

  fixture.setOnRequest(() => {
    fixture.setAcademy({
      ...initial,
      academyId: 'other-academy',
    })
  })

  await assert.rejects(
    fixture.query('academy-dev', 'manager-dev'),
    /ACADEMY_CONTEXT_CHANGED/,
  )
})

test('identificadores e cursor invalidos nao chamam backend', async () => {
  for (const [academyId, userId, cursor] of [
    ['', 'manager-dev', null],
    ['invalid/id', 'manager-dev', null],
    ['academy-dev', '', null],
    ['academy-dev', 'manager-dev', 'short'],
    ['academy-dev', 'manager-dev', 'a'.repeat(81)],
    ['academy-dev', 'manager-dev', 'request_student_123456\n'],
  ] as const) {
    const fixture = createFixture()

    await assert.rejects(
      fixture.query(academyId, userId, cursor),
      /INVALID_/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('pagina invalida ou de outra academia e rejeitada', async () => {
  const foreignPage = createPage()
  foreignPage.requests[0]!.academyId = 'other-academy'

  for (const response of [{}, foreignPage]) {
    const fixture = createFixture()
    fixture.setResponse(response)

    await assert.rejects(
      fixture.query('academy-dev', 'manager-dev'),
      /SENT_LINK_REQUEST_/,
    )
  }
})

test('pagina nao pode repetir ou retroceder antes do cursor', async () => {
  for (const cursor of [
    'request_student_123456',
    'request_student_123457',
  ]) {
    const fixture = createFixture()

    await assert.rejects(
      fixture.query('academy-dev', 'manager-dev', cursor),
      /INVALID_SENT_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('falha do backend e propagada sem repetir consulta', async () => {
  const fixture = createFixture()

  fixture.setOnRequest(() => {
    throw new Error('BACKEND_UNAVAILABLE')
  })

  await assert.rejects(
    fixture.query('academy-dev', 'manager-dev'),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(fixture.payloads.length, 1)
})