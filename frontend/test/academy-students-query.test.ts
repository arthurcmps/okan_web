import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyStudentsQuery,
} from '../src/features/academies/academy-students-query.ts'
import type {
  AcademyStudentsRequest,
} from '../src/features/academies/academy-students-query.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

const USER_ID = 'manager-dev'
const ACADEMY_ID = 'academy-dev'

function membershipId(index: number): string {
  return `membership_${index.toString(16).padStart(64, '0')}`
}

function createAcademy(): AcademyMembershipContext {
  return {
    membershipId: membershipId(99),
    schemaVersion: 1,
    academyId: ACADEMY_ID,
    userId: USER_ID,
    roles: ['gym_admin'],
    status: 'active',
    canManage: true,
  }
}

function createPage(index = 1) {
  return {
    students: [{
      membershipId: membershipId(index),
      schemaVersion: 1,
      academyId: ACADEMY_ID,
      userId: `student-${index}`,
      roles: ['aluno'],
      status: 'active',
    }],
    nextCursor: null,
  }
}

test('envia somente academia e cursor e valida a resposta', async () => {
  const session = { uid: USER_ID }
  const academy = createAcademy()
  const requests: AcademyStudentsRequest[] = []

  const query = createAcademyStudentsQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestPage: async (request) => {
      requests.push(request)
      return createPage(request.cursor ? 21 : 1)
    },
  })

  const first = await query(ACADEMY_ID, USER_ID)
  const next = await query(ACADEMY_ID, USER_ID, membershipId(20))

  assert.deepEqual(requests, [
    { academyId: ACADEMY_ID },
    { academyId: ACADEMY_ID, cursor: membershipId(20) },
  ])

  assert.equal(first.students[0]?.userId, 'student-1')
  assert.equal(next.students[0]?.userId, 'student-21')
})

test('preserva página vazia explícita', async () => {
  const session = { uid: USER_ID }
  const academy = createAcademy()

  const query = createAcademyStudentsQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestPage: async () => ({
      students: [],
      nextCursor: null,
    }),
  })

  assert.deepEqual(await query(ACADEMY_ID, USER_ID), {
    students: [],
    nextCursor: null,
  })
})

test('sem sessão não consulta o backend', async () => {
  let calls = 0

  const query = createAcademyStudentsQuery({
    getCurrentSession: () => null,
    getCurrentAcademy: () => createAcademy(),
    requestPage: async () => {
      calls += 1
      return createPage()
    },
  })

  await assert.rejects(query(ACADEMY_ID, USER_ID), {
    message: 'AUTHENTICATION_REQUIRED',
  })

  assert.equal(calls, 0)
})

test('sessão divergente não consulta o backend', async () => {
  let calls = 0
  const session = { uid: 'other-user' }

  const query = createAcademyStudentsQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => createAcademy(),
    requestPage: async () => {
      calls += 1
      return createPage()
    },
  })

  await assert.rejects(query(ACADEMY_ID, USER_ID), {
    message: 'AUTHENTICATION_CHANGED',
  })

  assert.equal(calls, 0)
})

test('identificadores e cursor inválidos não consultam', async () => {
  let calls = 0
  const session = { uid: USER_ID }
  const academy = createAcademy()

  const query = createAcademyStudentsQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestPage: async () => {
      calls += 1
      return createPage()
    },
  })

  await assert.rejects(query(' academy-dev ', USER_ID))
  await assert.rejects(query(ACADEMY_ID, ' manager-dev '))
  await assert.rejects(query(ACADEMY_ID, USER_ID, 'invalid'))

  assert.equal(calls, 0)
})

test('contexto ausente divergente ou sem gestão não consulta', async () => {
  const contexts: (AcademyMembershipContext | null)[] = [
    null,
    { ...createAcademy(), academyId: 'other-academy' },
    { ...createAcademy(), userId: 'other-user' },
    { ...createAcademy(), status: 'suspended', canManage: false },
    { ...createAcademy(), roles: ['aluno'], canManage: false },
    { ...createAcademy(), roles: ['aluno'], canManage: true },
  ]

  for (const academy of contexts) {
    let calls = 0
    const session = { uid: USER_ID }

    const query = createAcademyStudentsQuery({
      getCurrentSession: () => session,
      getCurrentAcademy: () => academy,
      requestPage: async () => {
        calls += 1
        return createPage()
      },
    })

    await assert.rejects(query(ACADEMY_ID, USER_ID))
    assert.equal(calls, 0)
  }
})

test('rejeita resposta inválida ou de outra academia', async () => {
  const session = { uid: USER_ID }
  const academy = createAcademy()
  const foreignPage = createPage()

  foreignPage.students[0]!.academyId = 'other-academy'

  for (const response of [null, {}, foreignPage]) {
    const query = createAcademyStudentsQuery({
      getCurrentSession: () => session,
      getCurrentAcademy: () => academy,
      requestPage: async () => response,
    })

    await assert.rejects(query(ACADEMY_ID, USER_ID))
  }
})

test('preserva o erro original da chamada ao backend', async () => {
  const session = { uid: USER_ID }
  const academy = createAcademy()
  const originalError = new Error('permission-denied')

  const query = createAcademyStudentsQuery({
    getCurrentSession: () => session,
    getCurrentAcademy: () => academy,
    requestPage: async () => {
      throw originalError
    },
  })

  await assert.rejects(
    query(ACADEMY_ID, USER_ID),
    (error: unknown) => error === originalError,
  )
})

test('descarta resposta após logout ou substituição da sessão', async () => {
  const replacements: (MembershipSession | null)[] = [
    null,
    { uid: 'other-user' },
    { uid: USER_ID },
  ]

  for (const replacement of replacements) {
    let session: MembershipSession | null = { uid: USER_ID }
    const academy = createAcademy()

    let resolveResponse!: (response: unknown) => void

    const pendingResponse = new Promise<unknown>((resolve) => {
      resolveResponse = resolve
    })

    const query = createAcademyStudentsQuery({
      getCurrentSession: () => session,
      getCurrentAcademy: () => academy,
      requestPage: () => pendingResponse,
    })

    const pendingQuery = query(ACADEMY_ID, USER_ID)

    const rejection = assert.rejects(pendingQuery, {
      message: 'AUTHENTICATION_CHANGED',
    })

    session = replacement
    resolveResponse(createPage())

    await rejection
  }
})

test('descarta resposta após mudança ou revalidação da academia', async () => {
  const replacements: (AcademyMembershipContext | null)[] = [
    null,
    { ...createAcademy(), academyId: 'other-academy' },
    createAcademy(),
    { ...createAcademy(), status: 'suspended', canManage: false },
  ]

  for (const replacement of replacements) {
    const session = { uid: USER_ID }
    let academy: AcademyMembershipContext | null = createAcademy()

    let resolveResponse!: (response: unknown) => void

    const pendingResponse = new Promise<unknown>((resolve) => {
      resolveResponse = resolve
    })

    const query = createAcademyStudentsQuery({
      getCurrentSession: () => session,
      getCurrentAcademy: () => academy,
      requestPage: () => pendingResponse,
    })

    const pendingQuery = query(ACADEMY_ID, USER_ID)

    const rejection = assert.rejects(pendingQuery, {
      message: 'ACADEMY_CONTEXT_CHANGED',
    })

    academy = replacement
    resolveResponse(createPage())

    await rejection
  }
})