import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyStudentStatusCommand,
} from '../src/features/academies/academy-student-status-command.ts'

import type {
  AcademyStudentStatusRequest,
} from '../src/features/academies/academy-student-status-command.ts'

import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'

import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

import type {
  AcademyStudentMembership,
} from '../src/features/academies/academy-students-page.ts'

const REQUEST_ID = '12345678-1234-1234-1234-123456789abc'

function createStudent(): AcademyStudentMembership {
  return {
    membershipId: `membership_${'b'.repeat(64)}`,
    schemaVersion: 1,
    academyId: 'academy-dev',
    userId: 'student-dev',
    roles: ['aluno', 'professor'],
    status: 'active',
    studentName: 'Ana Silva',
  }
}

function createAcademy(): AcademyMembershipContext {
  return {
    membershipId: `membership_${'a'.repeat(64)}`,
    schemaVersion: 1,
    academyId: 'academy-dev',
    userId: 'manager-dev',
    roles: ['gym_admin'],
    status: 'active',
    canManage: true,
  }
}

function createHarness() {
  let session: MembershipSession | null = { uid: 'manager-dev' }
  let academy: AcademyMembershipContext | null = createAcademy()
  const requests: AcademyStudentStatusRequest[] = []

  let responder = async (
    request: AcademyStudentStatusRequest,
  ): Promise<unknown> => ({
    membershipId: createStudent().membershipId,
    academyId: request.academyId,
    userId: request.targetUid,
    status: request.nextStatus,
    alreadyProcessed: false,
  })

  const command = createAcademyStudentStatusCommand({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestChange: async (request) => {
      requests.push(request)
      return responder(request)
    },
  })

  return {
    command,
    requests,
    setSession(value: MembershipSession | null) {
      session = value
    },
    setAcademy(value: AcademyMembershipContext | null) {
      academy = value
    },
    setResponder(value: typeof responder) {
      responder = value
    },
  }
}

function createAction() {
  return {
    student: createStudent(),
    expectedUserId: 'manager-dev',
    nextStatus: 'suspended' as const,
    requestId: REQUEST_ID,
  }
}

test('envia somente campos permitidos e valida resultado', async () => {
  const harness = createHarness()
  const result = await harness.command(createAction())

  assert.deepEqual(harness.requests, [{
    academyId: 'academy-dev',
    targetUid: 'student-dev',
    expectedStatus: 'active',
    nextStatus: 'suspended',
    requestId: REQUEST_ID,
  }])

  assert.equal(result.status, 'suspended')
  assert.equal(result.alreadyProcessed, false)
})

test('sem sessao nao envia alteracao', async () => {
  const harness = createHarness()
  harness.setSession(null)

  await assert.rejects(
    () => harness.command(createAction()),
    /AUTHENTICATION_REQUIRED/,
  )

  assert.equal(harness.requests.length, 0)
})

test('sessao divergente nao envia alteracao', async () => {
  const harness = createHarness()
  harness.setSession({ uid: 'another-manager' })

  await assert.rejects(
    () => harness.command(createAction()),
    /AUTHENTICATION_CHANGED/,
  )

  assert.equal(harness.requests.length, 0)
})

test('requestId e estados invalidos nao enviam alteracao', async () => {
  const harness = createHarness()

  for (const requestId of ['', 'short', 'invalid/request/id']) {
    await assert.rejects(
      () => harness.command({ ...createAction(), requestId }),
      /INVALID_STUDENT_STATUS_REQUEST_ID/,
    )
  }

  for (const status of ['pending', 'suspended', 'ended'] as const) {
    await assert.rejects(
      () => harness.command({
        ...createAction(),
        student: { ...createStudent(), status },
      }),
      /INVALID_STUDENT_STATUS_CHANGE/,
    )
  }

  assert.equal(harness.requests.length, 0)
})

test('bloqueia outro contexto gestores e autoalteracao', async () => {
  const harness = createHarness()

  for (const student of [
    { ...createStudent(), academyId: 'another-academy' },
    { ...createStudent(), userId: 'manager-dev' },
    {
      ...createStudent(),
      roles: ['aluno', 'gym_admin'] as const,
    },
  ]) {
    await assert.rejects(
      () => harness.command({ ...createAction(), student }),
    )
  }

  assert.equal(harness.requests.length, 0)
})

test('contexto ausente ou sem gestao nao envia alteracao', async () => {
  const harness = createHarness()

  for (const academy of [
    null,
    { ...createAcademy(), userId: 'another-manager' },
    { ...createAcademy(), status: 'suspended' as const },
    { ...createAcademy(), canManage: false },
    { ...createAcademy(), roles: ['aluno'] as const },
  ]) {
    harness.setAcademy(academy)

    await assert.rejects(
      () => harness.command(createAction()),
    )
  }

  assert.equal(harness.requests.length, 0)
})

test('rejeita resposta invalida ou de outro contexto', async () => {
  for (const response of [
    null,
    {},
    {
      membershipId: createStudent().membershipId,
      academyId: 'another-academy',
      userId: 'student-dev',
      status: 'suspended',
      alreadyProcessed: false,
    },
  ]) {
    const harness = createHarness()
    harness.setResponder(async () => response)

    await assert.rejects(
      () => harness.command(createAction()),
    )
  }
})

test('preserva erro original devolvido pelo backend', async () => {
  const harness = createHarness()
  const originalError = new Error('BACKEND_DENIED')

  harness.setResponder(async () => {
    throw originalError
  })

  await assert.rejects(
    () => harness.command(createAction()),
    (error: unknown) => error === originalError,
  )
})

test('descarta resposta apos logout ou substituicao da sessao',
  async () => {
    for (const session of [
      null,
      { uid: 'another-manager' },
      { uid: 'manager-dev' },
    ]) {
      const harness = createHarness()

      harness.setResponder(async (request) => {
        harness.setSession(session)

        return {
          membershipId: createStudent().membershipId,
          academyId: request.academyId,
          userId: request.targetUid,
          status: 'suspended',
          alreadyProcessed: false,
        }
      })

      await assert.rejects(
        () => harness.command(createAction()),
        /AUTHENTICATION_CHANGED/,
      )
    }
  },
)

test('descarta resposta apos troca ou revalidacao da academia',
  async () => {
    for (const academy of [
      null,
      createAcademy(),
      { ...createAcademy(), academyId: 'another-academy' },
    ]) {
      const harness = createHarness()

      harness.setResponder(async (request) => {
        harness.setAcademy(academy)

        return {
          membershipId: createStudent().membershipId,
          academyId: request.academyId,
          userId: request.targetUid,
          status: 'suspended',
          alreadyProcessed: false,
        }
      })

      await assert.rejects(
        () => harness.command(createAction()),
        /ACADEMY_CONTEXT_CHANGED/,
      )
    }
  },
)