import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademyMembershipPage,
} from '../src/features/academies/academy-membership-list.ts'

const USER_ID = 'usuario-dev'

function membershipId(index: number): string {
  return `membership_${index.toString(16).padStart(64, '0')}`
}

function createMembership(index: number) {
  return {
    membershipId: membershipId(index),
    schemaVersion: 1,
    academyId: `academia-${index}`,
    userId: USER_ID,
    roles: ['gym_admin', 'aluno'],
    status: 'active',
    canManage: true,
  }
}

function createItems(count: number, start = 1) {
  return Array.from(
    { length: count },
    (_, index) => createMembership(start + index),
  )
}

test('aceita página vazia com fim explícito', () => {
  const page = normalizeAcademyMembershipPage(
    { memberships: [], nextCursor: null },
    { userId: USER_ID },
  )

  assert.deepEqual(page, {
    memberships: [],
    nextCursor: null,
  })
})

test('valida 20 vínculos e preserva o próximo cursor', () => {
  const items = createItems(20)

  const page = normalizeAcademyMembershipPage(
    {
      memberships: items,
      nextCursor: membershipId(20),
    },
    { userId: USER_ID },
  )

  assert.equal(page.memberships.length, 20)
  assert.equal(page.nextCursor, membershipId(20))
  assert.equal(page.memberships[0]?.canManage, true)
  assert.deepEqual(page.memberships[0]?.roles, [
    'aluno',
    'gym_admin',
  ])
})

test('aceita página final após o cursor informado', () => {
  const page = normalizeAcademyMembershipPage(
    {
      memberships: createItems(5, 21),
      nextCursor: null,
    },
    {
      userId: USER_ID,
      cursor: membershipId(20),
    },
  )

  assert.equal(page.memberships.length, 5)
  assert.equal(page.nextCursor, null)
})

test('rejeita vínculos de outra conta e permissões incoerentes', () => {
  for (const item of [
    { ...createMembership(1), userId: 'outra-conta' },
    { ...createMembership(1), canManage: false },
    { ...createMembership(1), schemaVersion: 2 },
    {
      ...createMembership(1),
      roles: ['aluno'],
      canManage: true,
    },
  ]) {
    assert.throws(() => normalizeAcademyMembershipPage(
      { memberships: [item], nextCursor: null },
      { userId: USER_ID },
    ))
  }
})

test('rejeita resposta incompleta ou maior que uma página', () => {
  const invalidResponses: unknown[] = [
    null,
    [],
    {},
    { memberships: [] },
    { memberships: null, nextCursor: null },
    { memberships: [null], nextCursor: null },
    { memberships: createItems(21), nextCursor: null },
  ]

  for (const response of invalidResponses) {
    assert.throws(() => normalizeAcademyMembershipPage(
      response,
      { userId: USER_ID },
    ))
  }
})

test('rejeita cursor inválido ou incompatível com a página', () => {
  for (const nextCursor of [
    '',
    'invalid',
    123,
    membershipId(2),
  ]) {
    assert.throws(() => normalizeAcademyMembershipPage(
      {
        memberships: [createMembership(1)],
        nextCursor,
      },
      { userId: USER_ID },
    ))
  }

  assert.throws(() => normalizeAcademyMembershipPage(
    {
      memberships: createItems(20),
      nextCursor: membershipId(19),
    },
    { userId: USER_ID },
  ))

  assert.throws(() => normalizeAcademyMembershipPage(
    { memberships: [], nextCursor: null },
    { userId: USER_ID, cursor: 'invalid' },
  ))

  assert.throws(() => normalizeAcademyMembershipPage(
    { memberships: [], nextCursor: null },
    { userId: ' usuario-dev ' },
  ))
})

test('rejeita duplicação, ordem incorreta e retorno anterior ao cursor', () => {
  const invalidPages = [
    [createMembership(1), createMembership(1)],
    [createMembership(2), createMembership(1)],
    [
      createMembership(1),
      { ...createMembership(2), academyId: 'academia-1' },
    ],
  ]

  for (const memberships of invalidPages) {
    assert.throws(() => normalizeAcademyMembershipPage(
      { memberships, nextCursor: null },
      { userId: USER_ID },
    ))
  }

  assert.throws(() => normalizeAcademyMembershipPage(
    {
      memberships: [createMembership(20)],
      nextCursor: null,
    },
    {
      userId: USER_ID,
      cursor: membershipId(20),
    },
  ))
})

test('descarta campos adicionais e não modifica a resposta original', () => {
  const response = {
    memberships: [
      {
        ...createMembership(1),
        privateNote: 'não deve chegar à interface',
      },
    ],
    nextCursor: null,
    internalField: 'descartar',
  }

  const original = structuredClone(response)

  const page = normalizeAcademyMembershipPage(
    response,
    { userId: USER_ID },
  )

  assert.deepEqual(response, original)
  assert.equal(Object.hasOwn(page, 'internalField'), false)
  assert.equal(
    Object.hasOwn(page.memberships[0]!, 'privateNote'),
    false,
  )

  assert.equal(Object.isFrozen(page), true)
  assert.equal(Object.isFrozen(page.memberships), true)
  assert.equal(Object.isFrozen(page.memberships[0]), true)
  assert.equal(Object.isFrozen(page.memberships[0]?.roles), true)
})