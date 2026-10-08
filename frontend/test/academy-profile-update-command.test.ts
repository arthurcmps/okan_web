import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAcademyProfileUpdateCommand,
} from '../src/features/academies/academy-profile-update-command.ts'
import type {
  AcademyProfileUpdatePayload,
} from '../src/features/academies/academy-profile-update-command.ts'
import type {
  AcademyMembershipContext,
} from '../src/features/academies/academy-membership-context.ts'
import type {
  MembershipSession,
} from '../src/features/academies/academy-membership-query.ts'

function validFields() {
  return {
    nome: 'Academia de teste',
    cnpj: '12.345.678/0001-90',
    telefoneResponsavel: '(21) 99999-9999',
    cep: '25000-000',
    endereco: 'Rua de teste, 123',
    bairro: 'Centro',
    uf: 'RJ',
  }
}

function validAcademy(): AcademyMembershipContext {
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

function confirmation(
  payload: AcademyProfileUpdatePayload,
  updated = true,
  revision = payload.expectedRevision + 1,
) {
  return {
    academy: {
      academyId: payload.academyId,
      ...payload.fields,
      emailGestor: 'gestor@teste.com',
    },
    revision,
    updated,
  }
}

function setup(
  respond?: (payload: AcademyProfileUpdatePayload) => Promise<unknown>,
) {
  const state = {
    session: { uid: 'manager-dev' } as MembershipSession | null,
    academy: validAcademy() as AcademyMembershipContext | null,
    calls: [] as AcademyProfileUpdatePayload[],
  }

  const command = createAcademyProfileUpdateCommand({
    getCurrentSession: () => state.session,
    getCurrentAcademy: () => state.academy,

    requestUpdate: async (payload) => {
      state.calls.push(payload)

      return respond
        ? respond(payload)
        : confirmation(payload)
    },
  })

  return { state, command }
}

test('normaliza campos envia revisao e valida confirmacao', async () => {
  const { state, command } = setup()

  const result = await command(
    'academy-dev',
    'manager-dev',
    { ...validFields(), nome: ' Academia de teste ', uf: 'rj' },
    3,
  )

  assert.deepEqual(state.calls, [{
    academyId: 'academy-dev',
    fields: validFields(),
    expectedRevision: 3,
  }])

  assert.equal(result.updated, true)
  assert.equal(result.revision, 4)
})

test('sessao ausente ou diferente bloqueia antes do envio', async () => {
  for (const session of [null, { uid: 'other-manager' }]) {
    const { state, command } = setup()
    state.session = session

    await assert.rejects(
      command('academy-dev', 'manager-dev', validFields(), 0),
      /AUTHENTICATION_REQUIRED|AUTHENTICATION_CHANGED/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('academia ausente diferente ou sem permissao bloqueia', async () => {
  const invalidAcademies: Array<AcademyMembershipContext | null> = [
    null,
    { ...validAcademy(), academyId: 'other-academy' },
    { ...validAcademy(), userId: 'other-manager' },
    { ...validAcademy(), status: 'suspended', canManage: false },
    { ...validAcademy(), roles: ['aluno'], canManage: false },
  ]

  for (const academy of invalidAcademies) {
    const { state, command } = setup()
    state.academy = academy

    await assert.rejects(
      command('academy-dev', 'manager-dev', validFields(), 0),
      /ACADEMY_CONTEXT_CHANGED|ACADEMY_MANAGEMENT_FORBIDDEN/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('campos protegidos incompletos ou invalidos nao sao enviados',
  async () => {
    for (const fields of [
      {},
      { ...validFields(), nome: '' },
      { ...validFields(), uf: 'RIO' },
      { ...validFields(), cnpj: 123 },
      { ...validFields(), emailGestor: 'outro@teste.com' },
      { ...validFields(), ownerUid: 'outro-gestor' },
      { ...validFields(), licencasTotais: 999 },
      { ...validFields(), cancelamentoAgendado: true },
    ]) {
      const { state, command } = setup()

      await assert.rejects(
        command('academy-dev', 'manager-dev', fields, 0),
        /INVALID_ACADEMY_PROFILE_FIELDS/,
      )

      assert.deepEqual(state.calls, [])
    }
  },
)

test('identificadores e revisoes invalidos nao sao enviados', async () => {
  for (const [academyId, userId] of [
    ['', 'manager-dev'],
    ['academias/academy-dev', 'manager-dev'],
    ['academy-dev', ''],
  ]) {
    const { state, command } = setup()

    await assert.rejects(
      command(academyId, userId, validFields(), 0),
      /INVALID_ACADEMY_ID|INVALID_MEMBERSHIP_CONTEXT/,
    )

    assert.deepEqual(state.calls, [])
  }

  for (const revision of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const { state, command } = setup()

    await assert.rejects(
      command('academy-dev', 'manager-dev', validFields(), revision),
      /INVALID_ACADEMY_PROFILE_REVISION/,
    )

    assert.deepEqual(state.calls, [])
  }
})

test('troca de sessao durante envio descarta confirmacao', async () => {
  const { state, command } = setup(async (payload) => {
    state.session = null
    return confirmation(payload)
  })

  await assert.rejects(
    command('academy-dev', 'manager-dev', validFields(), 0),
    /AUTHENTICATION_CHANGED/,
  )
})

test('troca de academia durante envio descarta confirmacao', async () => {
  const { state, command } = setup(async (payload) => {
    state.academy = { ...validAcademy(), academyId: 'other-academy' }
    return confirmation(payload)
  })

  await assert.rejects(
    command('academy-dev', 'manager-dev', validFields(), 0),
    /ACADEMY_CONTEXT_CHANGED/,
  )
})

test('resposta de outra academia nao confirma sucesso', async () => {
  const { command } = setup(async (payload) => ({
    ...confirmation(payload),
    academy: {
      ...confirmation(payload).academy,
      academyId: 'other-academy',
    },
  }))

  await assert.rejects(
    command('academy-dev', 'manager-dev', validFields(), 0),
    /ACADEMY_PROFILE_CONTEXT_MISMATCH/,
  )
})

test('confirmacao com dados ou revisao divergentes e rejeitada', async () => {
  for (const changes of ['fields', 'revision']) {
    const { command } = setup(async (payload) => {
      const result = confirmation(payload)

      return changes === 'fields'
        ? {
          ...result,
          academy: { ...result.academy, nome: 'Outro nome' },
        }
        : { ...result, revision: 99 }
    })

    await assert.rejects(
      command('academy-dev', 'manager-dev', validFields(), 0),
      /ACADEMY_PROFILE_UPDATE_CONFIRMATION_MISMATCH/,
    )
  }
})

test('aceita dados ja existentes com revisao atual do backend', async () => {
  const { command } = setup(async (payload) => {
    return confirmation(payload, false, 5)
  })

  const result = await command(
    'academy-dev',
    'manager-dev',
    validFields(),
    4,
  )

  assert.equal(result.updated, false)
  assert.equal(result.revision, 5)
})

test('falha do backend e propagada sem repetir envio', async () => {
  const { state, command } = setup(async () => {
    throw new Error('REVISION_CONFLICT')
  })

  await assert.rejects(
    command('academy-dev', 'manager-dev', validFields(), 0),
    /REVISION_CONFLICT/,
  )

  assert.equal(state.calls.length, 1)
})