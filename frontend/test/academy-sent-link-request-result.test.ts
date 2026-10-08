import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeAcademySentLinkRequestPage,
} from '../src/features/academies/academy-sent-link-request-result.ts'

function createRequest(index = 0) {
  return {
    requestId: `request_${String(index).padStart(16, '0')}`,
    academyId: 'academy-dev',
    status: 'pending',
    createdAtMs: 1000,
    expiresAtMs: 5000,
    respondedAtMs: null as number | null,
  }
}

test('valida pagina e retorna estruturas imutaveis', () => {
  const request = createRequest()

  const result = normalizeAcademySentLinkRequestPage({
    requests: [request],
    nextCursor: null,
  })

  assert.deepEqual(result, {
    requests: [request],
    nextCursor: null,
  })

  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.requests), true)
  assert.equal(Object.isFrozen(result.requests[0]), true)
})

test('pagina vazia exige cursor nulo', () => {
  assert.deepEqual(
    normalizeAcademySentLinkRequestPage({
      requests: [],
      nextCursor: null,
    }),
    { requests: [], nextCursor: null },
  )

  assert.throws(
    () => normalizeAcademySentLinkRequestPage({
      requests: [],
      nextCursor: createRequest().requestId,
    }),
    /INVALID_SENT_LINK_REQUEST_RESPONSE/,
  )
})

test('aceita os cinco estados com datas consistentes', () => {
  for (const status of [
    'pending',
    'accepted',
    'rejected',
    'expired',
    'cancelled',
  ]) {
    const hasResponse = [
      'accepted',
      'rejected',
      'cancelled',
    ].includes(status)

    const result = normalizeAcademySentLinkRequestPage({
      requests: [{
        ...createRequest(),
        status,
        respondedAtMs: hasResponse ? 1500 : null,
      }],
      nextCursor: null,
    })

    assert.equal(result.requests[0]!.status, status)
  }
})

test('rejeita pagina ausente incompleta ou de tipo incorreto', () => {
  for (const value of [
    undefined,
    null,
    [],
    'invalid',
    {},
    { requests: [], nextCursor: undefined },
    { requests: 'invalid', nextCursor: null },
    { requests: [], nextCursor: 123 },
  ]) {
    assert.throws(
      () => normalizeAcademySentLinkRequestPage(value),
      /INVALID_SENT_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('rejeita identificadores estados e horarios invalidos', () => {
  for (const changes of [
    { requestId: 'short' },
    { requestId: `${createRequest().requestId}\n` },
    { requestId: 'a'.repeat(81) },
    { academyId: 'invalid/id' },
    { academyId: '' },
    { status: 'unknown' },
    { createdAtMs: -1 },
    { createdAtMs: 1.5 },
    { expiresAtMs: 1000 },
    { expiresAtMs: NaN },
    { respondedAtMs: 1500 },
    { status: 'accepted', respondedAtMs: null },
    { status: 'rejected', respondedAtMs: 999 },
    { status: 'cancelled', respondedAtMs: 5000 },
  ]) {
    assert.throws(
      () => normalizeAcademySentLinkRequestPage({
        requests: [{ ...createRequest(), ...changes }],
        nextCursor: null,
      }),
      /INVALID_SENT_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('rejeita excesso repeticao e ordem incorreta', () => {
  const first = createRequest(0)
  const second = createRequest(1)

  for (const requests of [
    Array.from({ length: 21 }, (_, index) => createRequest(index)),
    [first, first],
    [second, first],
  ]) {
    assert.throws(
      () => normalizeAcademySentLinkRequestPage({
        requests,
        nextCursor: null,
      }),
      /INVALID_SENT_LINK_REQUEST_RESPONSE/,
    )
  }
})

test('cursor deve corresponder ao ultimo item de uma pagina cheia', () => {
  const requests = Array.from(
    { length: 20 },
    (_, index) => createRequest(index),
  )

  const result = normalizeAcademySentLinkRequestPage({
    requests,
    nextCursor: requests[19]!.requestId,
  })

  assert.equal(result.nextCursor, requests[19]!.requestId)

  for (const page of [
    { requests, nextCursor: requests[0]!.requestId },
    { requests: [requests[0]], nextCursor: requests[0]!.requestId },
  ]) {
    assert.throws(
      () => normalizeAcademySentLinkRequestPage(page),
      /INVALID_SENT_LINK_REQUEST_RESPONSE/,
    )
  }

  assert.equal(
    normalizeAcademySentLinkRequestPage({
      requests,
      nextCursor: null,
    }).nextCursor,
    null,
  )
})

test('descarta identidade e ticket sem alterar a resposta original', () => {
  const original = {
    requests: [{
      ...createRequest(),
      userId: 'student-private',
      requestedBy: 'manager-private',
      email: 'aluno@example.com',
      ticketId: 'ticket-private',
      roles: ['gym_admin'],
    }],
    nextCursor: null,
    enabled: true,
  }

  const copy = structuredClone(original)
  const result = normalizeAcademySentLinkRequestPage(original)

  assert.deepEqual(result, {
    requests: [createRequest()],
    nextCursor: null,
  })

  assert.deepEqual(original, copy)
})