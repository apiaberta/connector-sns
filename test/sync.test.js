import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASETS_BY_KEY } from '../src/datasets.js'
import { shouldSkip, shouldDeleteStale, fetchDatasetUpdate } from '../src/sync.js'

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/catalog.json'), 'utf8')
)
const raw = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/raw-records.json'), 'utf8')
)

function mockFetch(handlers) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const path = url.split('?')[0]
    // Prefer /exports over /catalog so the export URL is not swallowed by the catalog prefix.
    const patterns = Object.keys(handlers).sort((a, b) => Number(b.includes('/exports')) - Number(a.includes('/exports')))
    for (const pattern of patterns) {
      if (path.includes(pattern) || url.includes(pattern)) {
        const payload = typeof handlers[pattern] === 'function' ? handlers[pattern](url) : handlers[pattern]
        const buf = Buffer.from(JSON.stringify(payload))
        return {
          ok: true,
          headers: { get: (name) => (name.toLowerCase() === 'content-length' ? String(buf.length) : null) },
          json: async () => payload,
          arrayBuffer: async () => buf
        }
      }
    }
    throw new Error(`Unexpected fetch ${url}`)
  }
  fetchImpl.calls = calls
  return fetchImpl
}

describe('shouldSkip', () => {
  it('skips when stored data_processed equals the catalog value', () => {
    assert.equal(
      shouldSkip('2026-10-23T10:46:58.289000+00:00', catalog.metas.default.data_processed),
      true
    )
  })

  it('does not skip when the catalog timestamp changed', () => {
    assert.equal(
      shouldSkip('2026-01-01T00:00:00.000000+00:00', catalog.metas.default.data_processed),
      false
    )
  })

  it('does not skip when nothing is stored yet', () => {
    assert.equal(shouldSkip(null, catalog.metas.default.data_processed), false)
    assert.equal(shouldSkip(undefined, catalog.metas.default.data_processed), false)
  })
})

describe('shouldDeleteStale (sanity guard)', () => {
  it('allows delete when the new count is at least 80% of the previous', () => {
    assert.equal(shouldDeleteStale(80, 100), true)
    assert.equal(shouldDeleteStale(100, 100), true)
    assert.equal(shouldDeleteStale(200, 100), true)
  })

  it('blocks delete when the new count is below 80% of the previous', () => {
    assert.equal(shouldDeleteStale(79, 100), false)
    assert.equal(shouldDeleteStale(1, 100), false)
  })

  it('allows delete when there was no previous count', () => {
    assert.equal(shouldDeleteStale(0, 0), true)
    assert.equal(shouldDeleteStale(10, null), true)
  })
})

describe('fetchDatasetUpdate skip-when-unchanged', () => {
  it('does not call the export when data_processed is unchanged', async () => {
    const ds = DATASETS_BY_KEY.urgencias_triagem
    const fetchImpl = mockFetch({
      '/catalog/datasets/atendimentos-em-urgencia-triagem-manchester': catalog,
      '/exports/json': raw.urgencias_triagem
    })
    const result = await fetchDatasetUpdate(ds, {
      fetchImpl,
      dataProcessed: catalog.metas.default.data_processed
    })
    assert.equal(result.skipped, true)
    assert.equal(result.rows, null)
    assert.equal(fetchImpl.calls.length, 1)
    assert.match(fetchImpl.calls[0], /\/catalog\/datasets\/atendimentos-em-urgencia-triagem-manchester$/)
    assert.equal(fetchImpl.calls.some(u => u.includes('/exports/json')), false)
  })

  it('calls the export when data_processed changed', async () => {
    const ds = DATASETS_BY_KEY.urgencias_triagem
    const fetchImpl = mockFetch({
      '/catalog/datasets/atendimentos-em-urgencia-triagem-manchester': catalog,
      '/exports/json': raw.urgencias_triagem
    })
    const result = await fetchDatasetUpdate(ds, {
      fetchImpl,
      dataProcessed: '2020-01-01T00:00:00.000000+00:00'
    })
    assert.equal(result.skipped, false)
    assert.equal(result.rows.length, 3)
    assert.equal(fetchImpl.calls.length, 2)
    assert.equal(fetchImpl.calls.some(u => u.includes('/exports/json')), true)
  })
})
