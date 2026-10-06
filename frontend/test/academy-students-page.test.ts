import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyStudentsPage,
} from '../src/features/academies/academy-students-page.ts'

const ACADEMY_ID = 'academy-dev'

function membershipId(index: number): string {
  return `membership_${index.toString(16).padStart(64, '0')}`
}

function createStudent(index: number) {
  return {
    membershipId: membershipId(index),
    schemaVersion: 1,
    academyId: ACADEMY_ID,
    userId: `student-${index}`,
    roles: ['aluno'],
    status: 'active',
  }
}

function createStudents(count: number, start = 1) {
  return Array.from(
    { length: count },
    (_, index) => createStudent(start + index),
  )
}

test('aceita lista vazia com fim explícito', () => {
  const page = normalizeAcademyStudentsPage(
    { students: [], nextCursor: null },
    { academyId: ACADEMY_ID },
  )

  assert.deepEqual(page, {
    students: [],
    nextCursor: null,
  })
})

test('preserva estados e alunos com múltiplos papéis', () => {
  const statuses = ['pending', 'active', 'suspended', 'ended']

  const page = normalizeAcademyStudentsPage(
    {
      students: statuses.map((status, index) => ({
        ...createStudent(index + 1),
        roles: ['professor', 'gym_admin', 'aluno'],
        status,
      })),
      nextCursor: null,
    },
    { academyId: ACADEMY_ID },
  )

  assert.deepEqual(
    page.students.map((student) => student.status),
    statuses,
  )

  assert.deepEqual(page.students[0]?.roles, [
    'aluno',
    'gym_admin',
    'professor',
  ])

  assert.equal(Object.hasOwn(page.students[0]!, 'canManage'), false)
})

test('valida primeira página e continuação pelo cursor', () => {
  const first = normalizeAcademyStudentsPage(
    {
      students: createStudents(20),
      nextCursor: membershipId(20),
    },
    { academyId: ACADEMY_ID },
  )

  const second = normalizeAcademyStudentsPage(
    {
      students: createStudents(2, 21),
      nextCursor: null,
    },
    {
      academyId: ACADEMY_ID,
      cursor: first.nextCursor,
    },
  )

  assert.equal(first.students.length, 20)
  assert.equal(second.students.length, 2)
  assert.equal(second.students[0]?.membershipId, membershipId(21))
  assert.equal(second.nextCursor, null)
})

test('rejeita outra academia e identificadores inválidos', () => {
  for (const student of [
    { ...createStudent(1), academyId: 'another-academy' },
    { ...createStudent(1), userId: ' invalid-user ' },
    { ...createStudent(1), userId: 'a/b' },
    { ...createStudent(1), membershipId: 'invalid' },
  ]) {
    assert.throws(() => normalizeAcademyStudentsPage(
      { students: [student], nextCursor: null },
      { academyId: ACADEMY_ID },
    ))
  }

  assert.throws(() => normalizeAcademyStudentsPage(
    { students: [], nextCursor: null },
    { academyId: ' academy-dev ' },
  ))
})

test('rejeita contratos inválidos e vínculo sem papel de aluno', () => {
  for (const student of [
    { ...createStudent(1), schemaVersion: 2 },
    { ...createStudent(1), roles: ['professor'] },
    { ...createStudent(1), roles: ['aluno', 'aluno'] },
    { ...createStudent(1), roles: ['aluno', 'super_admin'] },
    { ...createStudent(1), status: 'unknown' },
  ]) {
    assert.throws(() => normalizeAcademyStudentsPage(
      { students: [student], nextCursor: null },
      { academyId: ACADEMY_ID },
    ))
  }
})

test('rejeita página inválida duplicada ou fora de ordem', () => {
  const responses: unknown[] = [
    null,
    {},
    { students: [] },
    { students: null, nextCursor: null },
    { students: createStudents(21), nextCursor: null },
    {
      students: [createStudent(2), createStudent(1)],
      nextCursor: null,
    },
    {
      students: [createStudent(1), createStudent(1)],
      nextCursor: null,
    },
    {
      students: [
        createStudent(1),
        { ...createStudent(2), userId: 'student-1' },
      ],
      nextCursor: null,
    },
  ]

  for (const response of responses) {
    assert.throws(() => normalizeAcademyStudentsPage(
      response,
      { academyId: ACADEMY_ID },
    ))
  }
})

test('rejeita cursor inválido ou incompatível com a página', () => {
  for (const nextCursor of ['', 123, membershipId(1)]) {
    assert.throws(() => normalizeAcademyStudentsPage(
      {
        students: [createStudent(1)],
        nextCursor,
      },
      { academyId: ACADEMY_ID },
    ))
  }

  assert.throws(() => normalizeAcademyStudentsPage(
    {
      students: createStudents(20),
      nextCursor: membershipId(19),
    },
    { academyId: ACADEMY_ID },
  ))

  assert.throws(() => normalizeAcademyStudentsPage(
    { students: [], nextCursor: null },
    { academyId: ACADEMY_ID, cursor: 'invalid' },
  ))

  assert.throws(() => normalizeAcademyStudentsPage(
    { students: [createStudent(20)], nextCursor: null },
    { academyId: ACADEMY_ID, cursor: membershipId(20) },
  ))
})

test('descarta campos extras e preserva a resposta original', () => {
  const response = {
    students: [{
      ...createStudent(1),
      privateNote: 'interno',
      email: 'student@example.com',
      canManage: true,
    }],
    nextCursor: null,
    internalField: 'interno',
  }

  const original = structuredClone(response)

  const page = normalizeAcademyStudentsPage(
    response,
    { academyId: ACADEMY_ID },
  )

  const student = page.students[0]!

  assert.deepEqual(response, original)
  assert.equal(Object.hasOwn(page, 'internalField'), false)
  assert.equal(Object.hasOwn(student, 'privateNote'), false)
  assert.equal(Object.hasOwn(student, 'email'), false)
  assert.equal(Object.hasOwn(student, 'canManage'), false)

  assert.equal(Object.isFrozen(page), true)
  assert.equal(Object.isFrozen(page.students), true)
  assert.equal(Object.isFrozen(student), true)
  assert.equal(Object.isFrozen(student.roles), true)
})