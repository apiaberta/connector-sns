import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DATASETS_BY_KEY } from '../src/datasets.js'
import { mapRecord } from '../src/mapper.js'
import { aggregateNational, recomputeRatios } from '../src/national.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/raw-records.json'), 'utf8')
)

describe('recomputeRatios', () => {
  it('recomputes pct_dentro_tmrg from dentro_tmrg / inscritos, never averages', () => {
    const ds = DATASETS_BY_KEY.cirurgia_tmrg
    // 90/100 = 90% and 10/1000 = 1% — average would be 45.5, true national is 100/1100
    const result = recomputeRatios({ dentro_tmrg: 100, inscritos: 1100 }, ds)
    assert.ok(Math.abs(result.pct_dentro_tmrg - (100 / 1100) * 100) < 1e-10)
    assert.notEqual(result.pct_dentro_tmrg, (90 + 1) / 2)
  })

  it('uses realizadas as denominator for consultas_tmrg', () => {
    const result = recomputeRatios(
      { dentro_tmrg: 100, realizadas: 1100 },
      DATASETS_BY_KEY.consultas_tmrg
    )
    assert.ok(Math.abs(result.pct_dentro_tmrg - (100 / 1100) * 100) < 1e-10)
  })

  it('returns null when the denominator is zero', () => {
    const result = recomputeRatios(
      { dentro_tmrg: 10, inscritos: 0 },
      DATASETS_BY_KEY.cirurgia_tmrg
    )
    assert.equal(result.pct_dentro_tmrg, null)
  })
})

describe('aggregateNational', () => {
  it('sums counts by period and recomputes the percentage', () => {
    const ds = DATASETS_BY_KEY.cirurgia_tmrg
    const records = fixtures.cirurgia_tmrg.map(raw => mapRecord(raw, ds))
    const rows = aggregateNational(records, ds)
    const may = rows.find(r => r.period === '2026-05')
    assert.equal(may.dentro_tmrg, 100)
    assert.equal(may.inscritos, 1100)
    assert.ok(Math.abs(may.pct_dentro_tmrg - (100 / 1100) * 100) < 1e-10)
    const avgWouldBe = (90 + 1) / 2
    assert.notEqual(may.pct_dentro_tmrg, avgWouldBe)
  })

  it('sums urgencias totals without inventing a ratio', () => {
    const ds = DATASETS_BY_KEY.urgencias
    const records = fixtures.urgencias.map(raw => mapRecord(raw, ds))
    const rows = aggregateNational(records, ds)
    assert.equal(rows.length, 3)
    const may = rows.find(r => r.period === '2026-05')
    assert.equal(may.total, 1280)
    assert.equal(may.geral, 1000)
  })
})
