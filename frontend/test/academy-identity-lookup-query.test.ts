import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyIdentityLookupQuery,
} from '../src/features/academies/academy-identity-lookup-query.ts'
import type {
  AcademyIdentityLookupRequest,
} from '../src/features/academies/academy-identity-lookup-query.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

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

  let response: unknown = {
    ticketId: `lookup_${'b'.repeat(64)}`,
    expiresAtMs: 301000,
  }

  let onRequest = () => {}
  const requests: AcademyIdentityLookupRequest[] = []

  const lookup = createAcademyIdentityLookupQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    now: () => 1000,
    requestLookup: async (request) => {
      requests.push(request)
      onRequest()
      return response
    },
  })

  return {
    lookup,
    requests,
    setSession(value: MembershipSession | null) {
      session = value
    },
    setAcademy(value: AcademyMembershipContext | null) {
      academy = value
    },
    getAcademy() {
      return academy
    },
    setResponse(value: unknown) {
      response = value
    },
    onRequest(callback: () => void) {
      onRequest = callback
    },
  }
}

test('normaliza email e envia somente academia e email', async () => {
  const fixture = createFixture()

  const ticket = await fixture.lookup(
    'academy-dev',
    'manager-dev',
    ' Aluno+Treino@Example.com ',
  )

  assert.deepEqual(fixture.requests, [{
    academyId: 'academy-dev',
    email: 'aluno+treino@example.com',
  }])
  assert.equal(ticket?.ticketId, `lookup_${'b'.repeat(64)}`)
})

test('resultado ausente retorna null', async () => {
  const fixture = createFixture()
  fixture.setResponse(null)

  assert.equal(
    await fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
    null,
  )
})

test('sessao ausente ou diferente bloqueia antes da chamada', async () => {
  for (const session of [null, { uid: 'another-user' }]) {
    const fixture = createFixture()
    fixture.setSession(session)

    await assert.rejects(
      fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
      /AUTHENTICATION_REQUIRED|AUTHENTICATION_CHANGED/,
    )

    assert.equal(fixture.requests.length, 0)
  }
})

test('academia ausente ou sem permissao bloqueia consulta', async () => {
  const original = createFixture().getAcademy()!

  for (const academy of [
    null,
    { ...original, academyId: 'another-academy' },
    { ...original, userId: 'another-user' },
    { ...original, status: 'suspended' as const },
    { ...original, canManage: false },
    { ...original, roles: ['aluno'] as const },
  ]) {
    const fixture = createFixture()
    fixture.setAcademy(academy)

    await assert.rejects(
      fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
      /ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.equal(fixture.requests.length, 0)
  }
})

test('troca de sessao durante consulta descarta resultado', async () => {
  const fixture = createFixture()

  // Mesmo UID com outro objeto de sessão também invalida a operação.
  fixture.onRequest(() => {
    fixture.setSession({ uid: 'manager-dev' })
  })

  await assert.rejects(
    fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
    /AUTHENTICATION_CHANGED/,
  )
})

test('troca de academia durante consulta descarta resultado', async () => {
  const fixture = createFixture()

  fixture.onRequest(() => {
    fixture.setAcademy({
      ...fixture.getAcademy()!,
      academyId: 'another-academy',
    })
  })

  await assert.rejects(
    fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
    /ACADEMY_CONTEXT_CHANGED/,
  )
})

test('contexto e emails invalidos nao chamam backend', async () => {
  for (const [academyId, userId, email] of [
    ['a/b', 'manager-dev', 'a@b.com'],
    ['academy-dev', '', 'a@b.com'],
    ['academy-dev', 'manager-dev', ''],
    ['academy-dev', 'manager-dev', 'sem-arroba'],
    ['academy-dev', 'manager-dev', 'a@@b.com'],
    ['academy-dev', 'manager-dev', 'a b@c.com'],
    ['academy-dev', 'manager-dev', 'a\u0000@b.com'],
    ['academy-dev', 'manager-dev', `${'a'.repeat(254)}@b.com`],
  ]) {
    const fixture = createFixture()

    await assert.rejects(
      fixture.lookup(academyId, userId, email),
    )

    assert.equal(fixture.requests.length, 0)
  }
})

test('ticket expirado inclusive no limite e rejeitado', async () => {
  for (const expiresAtMs of [999, 1000]) {
    const fixture = createFixture()

    fixture.setResponse({
      ticketId: `lookup_${'b'.repeat(64)}`,
      expiresAtMs,
    })

    await assert.rejects(
      fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
      /IDENTITY_LOOKUP_TICKET_EXPIRED/,
    )
  }
})

test('resposta invalida do backend e rejeitada', async () => {
  const fixture = createFixture()
  fixture.setResponse({ targetUid: 'student-private' })

  await assert.rejects(
    fixture.lookup('academy-dev', 'manager-dev', 'a@b.com'),
    /INVALID_IDENTITY_LOOKUP_RESPONSE/,
  )
})