import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'
import { DatasetState } from '../src/models/datasetState.js'
import { formatDatasetList } from '../src/routes.js'

let app

before(async () => {
  app = await buildApp({ logger: false })
})

after(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'connector-sns')
    assert.equal(body.version, '1.0.0')
  })
})

describe('unknown dataset', () => {
  it('returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/sns/not-a-dataset' })
    assert.equal(res.statusCode, 400)
  })
})

describe('desde format validation', () => {
  it('returns 400 for a non YYYY-MM value', async () => {
    const res = await app.inject({ method: 'GET', url: '/sns/urgencias?desde=2026/07' })
    assert.equal(res.statusCode, 400)
  })

  it('returns 400 for a full date', async () => {
    const res = await app.inject({ method: 'GET', url: '/sns/urgencias?desde=2026-07-01' })
    assert.equal(res.statusCode, 400)
  })

  it('returns 400 for national desde as well', async () => {
    const res = await app.inject({ method: 'GET', url: '/sns/urgencias/national?desde=July' })
    assert.equal(res.statusCode, 400)
  })
})

describe('GET /sns/datasets from state', () => {
  it('merges config with stored state', () => {
    const list = formatDatasetList([{
      key: 'urgencias',
      records: 6521,
      period_from: '2013-01',
      period_to: '2026-07',
      last_changed: '2026-10-22T17:19:06.213Z'
    }])
    const u = list.find(d => d.key === 'urgencias')
    assert.equal(u.dataset_id, 'atendimentos-por-tipo-de-urgencia-hospitalar-link')
    assert.equal(u.records, 6521)
    assert.equal(u.period_from, '2013-01')
    assert.equal(u.period_to, '2026-07')
    assert.ok(u.metrics.includes('total'))
    assert.match(u.source_url, /atendimentos-por-tipo-de-urgencia-hospitalar-link/)
    const rh = list.find(d => d.key === 'rh')
    assert.equal(rh.records, 0)
    assert.equal(rh.period_from, null)
  })

  it('serves /sns/datasets from DatasetState', async () => {
    const orig = DatasetState.find
    DatasetState.find = () => ({
      lean: async () => [{
        key: 'urgencias',
        records: 3,
        period_from: '2026-05',
        period_to: '2026-07',
        last_changed: new Date('2026-10-01T00:00:00Z')
      }]
    })
    try {
      const res = await app.inject({ method: 'GET', url: '/sns/datasets' })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.ok(Array.isArray(body))
      assert.equal(body.length, 8)
      const u = body.find(d => d.key === 'urgencias')
      assert.equal(u.records, 3)
      assert.equal(u.period_from, '2026-05')
      assert.equal(u.title, 'Atendimentos por Tipo de Urgência Hospitalar')
    } finally {
      DatasetState.find = orig
    }
  })
})
