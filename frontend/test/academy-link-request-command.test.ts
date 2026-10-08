import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyLinkRequestCommand,
} from '../src/features/academies/academy-link-request-command.ts'
import type {
  AcademyLinkRequestPayload,
} from '../src/features/academies/academy-link-request-command.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const ticket = {
  ticketId: `lookup_${'b'.repeat(64)}`,
  expiresAtMs: 301000,
}

const response = {
  requestId: 'request_student_123456',
  expiresAtMs: 604801000,
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

  let result: unknown = response
  let onSend = () => {}
  const payloads: AcademyLinkRequestPayload[] = []

  const requestLink = createAcademyLinkRequestCommand({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    now: () => 1000,
    sendRequest: async (payload) => {
      payloads.push(payload)
      onSend()
      return result
    },
  })

  return {
    requestLink,
    payloads,
    setSession(value: MembershipSession | null) {
      session = value
    },
    setAcademy(value: AcademyMembershipContext | null) {
      academy = value
    },
    getAcademy() {
      return academy
    },
    setResult(value: unknown) {
      result = value
    },
    onSend(callback: () => void) {
      onSend = callback
    },
  }
}

test('envia somente academia e ticket e valida confirmacao', async () => {
  const fixture = createFixture()

  const result = await fixture.requestLink(
    'academy-dev',
    'manager-dev',
    {
      ...ticket,
      targetUid: 'student-private',
      roles: ['gym_admin'],
      requestDurationMs: 1,
    },
  )

  assert.deepEqual(fixture.payloads, [{
    academyId: 'academy-dev',
    ticketId: ticket.ticketId,
  }])
  assert.deepEqual(result, response)
})

test('sessao ausente ou diferente impede envio', async () => {
  for (const session of [null, { uid: 'another-user' }]) {
    const fixture = createFixture()
    fixture.setSession(session)

    await assert.rejects(
      fixture.requestLink('academy-dev', 'manager-dev', ticket),
      /AUTHENTICATION_REQUIRED|AUTHENTICATION_CHANGED/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('academia ausente ou sem permissao impede envio', async () => {
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
      fixture.requestLink('academy-dev', 'manager-dev', ticket),
      /ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('ticket ausente invalido ou expirado impede envio', async () => {
  for (const value of [
    null,
    {},
    { ...ticket, ticketId: 'invalid' },
    { ...ticket, expiresAtMs: 999 },
    { ...ticket, expiresAtMs: 1000 },
  ]) {
    const fixture = createFixture()

    await assert.rejects(
      fixture.requestLink('academy-dev', 'manager-dev', value),
      /IDENTITY_LOOKUP/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('identificadores invalidos impedem envio', async () => {
  for (const [academyId, userId] of [
    ['a/b', 'manager-dev'],
    ['academy-dev', ''],
  ]) {
    const fixture = createFixture()

    await assert.rejects(
      fixture.requestLink(academyId, userId, ticket),
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('troca de sessao durante envio descarta confirmacao', async () => {
  const fixture = createFixture()

  fixture.onSend(() => {
    fixture.setSession({ uid: 'manager-dev' })
  })

  await assert.rejects(
    fixture.requestLink('academy-dev', 'manager-dev', ticket),
    /AUTHENTICATION_CHANGED/,
  )

  assert.equal(fixture.payloads.length, 1)
})

test('troca de academia durante envio descarta confirmacao', async () => {
  const fixture = createFixture()

  fixture.onSend(() => {
    fixture.setAcademy({
      ...fixture.getAcademy()!,
      academyId: 'another-academy',
    })
  })

  await assert.rejects(
    fixture.requestLink('academy-dev', 'manager-dev', ticket),
    /ACADEMY_CONTEXT_CHANGED/,
  )

  assert.equal(fixture.payloads.length, 1)
})

test('resposta invalida e rejeitada sem repetir envio', async () => {
  const fixture = createFixture()
  fixture.setResult({ status: 'active' })

  await assert.rejects(
    fixture.requestLink('academy-dev', 'manager-dev', ticket),
    /INVALID_ACADEMY_LINK_REQUEST_RESPONSE/,
  )

  assert.equal(fixture.payloads.length, 1)
})

test('falha do backend e propagada sem repetir envio', async () => {
  const fixture = createFixture()

  fixture.onSend(() => {
    throw new Error('BACKEND_UNAVAILABLE')
  })

  await assert.rejects(
    fixture.requestLink('academy-dev', 'manager-dev', ticket),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(fixture.payloads.length, 1)
})