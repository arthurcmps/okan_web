import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDevEnvironment,
  devEnvironment,
} from '../src/core/config/dev-environment.ts'

test('aceita desenvolvimento em loopback', () => {
  assert.doesNotThrow(() => {
    assertDevEnvironment(true, '127.0.0.1')
  })

  assert.doesNotThrow(() => {
    assertDevEnvironment(true, 'localhost')
  })
})

test('bloqueia execução fora do modo desenvolvimento', () => {
  assert.throws(() => {
    assertDevEnvironment(false, '127.0.0.1')
  })
})

test('bloqueia domínio externo mesmo em desenvolvimento', () => {
  assert.throws(() => {
    assertDevEnvironment(true, 'okan.example.com')
  })
})

test('configuração aponta somente para o projeto demo', () => {
  assert.equal(devEnvironment.projectId, 'demo-okan-dev')
  assert.equal(devEnvironment.host, '127.0.0.1')
  assert.equal(devEnvironment.functionsRegion, 'southamerica-east1')
})