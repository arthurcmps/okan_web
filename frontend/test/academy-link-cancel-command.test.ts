import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyLinkCancelCommand,
} from '../src/features/academies/academy-link-cancel-command.ts'
import type {
  AcademyLinkCancelPayload,
} from '../src/features/academies/academy-link-cancel-command.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const requestId = 'request_student_123456'

function createResult() {
  return {
    requestId,
    academyId: 'academy-dev',
    status: 'cancelled',
    alreadyProcessed: false,
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

  let response: unknown = createResult()
  let onSend: () => void = () => {}

  const payloads: AcademyLinkCancelPayload[] = []

  const command = createAcademyLinkCancelCommand({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    sendCancel: async (payload) => {
      payloads.push(payload)
      onSend()
      return response
    },
  })

  return {
    command,
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
    setOnSend: (value: () => void) => {
      onSend = value
    },
  }
}

test('envia somente requestId e valida confirmacao', async () => {
  const fixture = createFixture()

  const result = await fixture.command(
    'academy-dev',
    'manager-dev',
    requestId,
  )

  assert.deepEqual(fixture.payloads, [{ requestId }])
  assert.deepEqual(result, createResult())
})

test('aceita confirmacao de cancelamento ja processado', async () => {
  const fixture = createFixture()

  fixture.setResponse({
    ...createResult(),
    alreadyProcessed: true,
  })

  const result = await fixture.command(
    'academy-dev',
    'manager-dev',
    requestId,
  )

  assert.equal(result.alreadyProcessed, true)
  assert.equal(fixture.payloads.length, 1)
})

test('sessao ausente ou diferente impede envio', async () => {
  for (const session of [null, { uid: 'other-user' }]) {
    const fixture = createFixture()
    fixture.setSession(session)

    await assert.rejects(
      fixture.command('academy-dev', 'manager-dev', requestId),
      /AUTHENTICATION_/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('academia ausente diferente ou sem permissao impede envio', async () => {
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
      fixture.command('academy-dev', 'manager-dev', requestId),
      /ACADEMY_/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('identificadores invalidos impedem envio', async () => {
  for (const [academyId, userId, selectedRequestId] of [
    ['', 'manager-dev', requestId],
    ['invalid/id', 'manager-dev', requestId],
    ['academy-dev', '', requestId],
    ['academy-dev', 'manager-dev', 'short'],
    ['academy-dev', 'manager-dev', 'a'.repeat(81)],
    ['academy-dev', 'manager-dev', `${requestId}\n`],
  ]) {
    const fixture = createFixture()

    await assert.rejects(
      fixture.command(academyId!, userId!, selectedRequestId!),
      /INVALID_/,
    )

    assert.equal(fixture.payloads.length, 0)
  }
})

test('troca de sessao durante envio descarta confirmacao', async () => {
  const fixture = createFixture()

  fixture.setOnSend(() => {
    fixture.setSession({ uid: 'manager-dev' })
  })

  await assert.rejects(
    fixture.command('academy-dev', 'manager-dev', requestId),
    /AUTHENTICATION_CHANGED/,
  )

  assert.equal(fixture.payloads.length, 1)
})

test('troca de academia durante envio descarta confirmacao', async () => {
  const fixture = createFixture()
  const source = fixture.getAcademy()!

  fixture.setOnSend(() => {
    fixture.setAcademy({
      ...source,
      academyId: 'other-academy',
    })
  })

  await assert.rejects(
    fixture.command('academy-dev', 'manager-dev', requestId),
    /ACADEMY_CONTEXT_CHANGED/,
  )
})

test('confirmacao de outra solicitacao ou academia e rejeitada', async () => {
  for (const changes of [
    { requestId: 'request_student_654321' },
    { academyId: 'other-academy' },
  ]) {
    const fixture = createFixture()
    fixture.setResponse({ ...createResult(), ...changes })

    await assert.rejects(
      fixture.command('academy-dev', 'manager-dev', requestId),
      /ACADEMY_LINK_CANCEL_CONTEXT_MISMATCH/,
    )

    assert.equal(fixture.payloads.length, 1)
  }
})

test('resposta invalida e rejeitada sem repetir envio', async () => {
  const fixture = createFixture()
  fixture.setResponse({ status: 'cancelled' })

  await assert.rejects(
    fixture.command('academy-dev', 'manager-dev', requestId),
    /INVALID_ACADEMY_LINK_CANCEL_RESPONSE/,
  )

  assert.equal(fixture.payloads.length, 1)
})

test('falha do backend e propagada sem repetir envio', async () => {
  const fixture = createFixture()

  fixture.setOnSend(() => {
    throw new Error('BACKEND_UNAVAILABLE')
  })

  await assert.rejects(
    fixture.command('academy-dev', 'manager-dev', requestId),
    /BACKEND_UNAVAILABLE/,
  )

  assert.equal(fixture.payloads.length, 1)
})