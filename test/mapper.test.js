import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASETS_BY_KEY, DATASET_KEYS } from '../src/datasets.js'
import { mapRecord, slugify, parsePeriod, parseGeo } from '../src/mapper.js'

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/raw-records.json'), 'utf8')
)

describe('mapRecord per dataset', () => {
  it('covers every curated dataset with three fixture rows', () => {
    for (const key of DATASET_KEYS) {
      assert.equal(fixtures[key]?.length, 3, `${key} should have 3 fixture rows`)
    }
  })

  it('maps urgencias metric names and drops periodoformat2', () => {
    const ds = DATASETS_BY_KEY.urgencias
    const mapped = mapRecord(fixtures.urgencias[0], ds)
    assert.equal(mapped.dataset, 'urgencias')
    assert.equal(mapped.period, '2026-05')
    assert.equal(mapped.metrics.geral, 1000)
    assert.equal(mapped.metrics.pediatrica, 200)
    assert.equal(mapped.metrics.obstetricia, 50)
    assert.equal(mapped.metrics.psiquiatrica, 30)
    assert.equal(mapped.metrics.total, 1280)
    assert.equal(mapped.metrics.periodoformat2, undefined)
  })

  it('maps triagem Manchester colours', () => {
    const mapped = mapRecord(fixtures.urgencias_triagem[0], DATASETS_BY_KEY.urgencias_triagem)
    assert.equal(mapped.metrics.vermelha, 278)
    assert.equal(mapped.metrics.laranja, 8758)
    assert.equal(mapped.metrics.amarela, 35888)
    assert.equal(mapped.metrics.verde, 12110)
    assert.equal(mapped.metrics.azul, 933)
    assert.equal(mapped.metrics.branca, 780)
    assert.equal(mapped.metrics.sem_triagem, 123)
  })

  it('maps cirurgia TMRG fields including percentage', () => {
    const mapped = mapRecord(fixtures.cirurgia_tmrg[2], DATASETS_BY_KEY.cirurgia_tmrg)
    assert.equal(mapped.metrics.dentro_tmrg, 3330)
    assert.equal(mapped.metrics.inscritos, 4094)
    assert.equal(mapped.metrics.pct_dentro_tmrg, 81.3)
  })

  it('maps cirurgia_tmrg_onco with the same field names', () => {
    const mapped = mapRecord(fixtures.cirurgia_tmrg_onco[0], DATASETS_BY_KEY.cirurgia_tmrg_onco)
    assert.equal(mapped.dataset, 'cirurgia_tmrg_onco')
    assert.equal(mapped.metrics.dentro_tmrg, 40)
    assert.equal(mapped.metrics.inscritos, 50)
    assert.equal(mapped.metrics.pct_dentro_tmrg, 80)
  })

  it('maps consultas_hospitalares', () => {
    const mapped = mapRecord(fixtures.consultas_hospitalares[0], DATASETS_BY_KEY.consultas_hospitalares)
    assert.equal(mapped.metrics.total, 5000)
    assert.equal(mapped.metrics.primeiras, 1200)
    assert.equal(mapped.metrics.subsequentes, 3800)
  })

  it('maps consultas_tmrg including the 1as_consultas source field', () => {
    const mapped = mapRecord(fixtures.consultas_tmrg[0], DATASETS_BY_KEY.consultas_tmrg)
    assert.equal(mapped.metrics.dentro_tmrg, 90)
    assert.equal(mapped.metrics.realizadas, 100)
    assert.equal(mapped.metrics.pct_dentro_tmrg, 90)
  })

  it('uses entidade and ponto_ou_localizacao_geografica for consultas_csp', () => {
    const mapped = mapRecord(fixtures.consultas_csp[0], DATASETS_BY_KEY.consultas_csp)
    assert.equal(mapped.entidade, 'ACES Alentejo Central')
    assert.equal(mapped.entidade_slug, 'aces-alentejo-central')
    assert.deepEqual(mapped.location, { type: 'Point', coordinates: [-7.907, 38.567] })
    assert.equal(mapped.metrics.presenciais, 12000)
    assert.equal(mapped.metrics.nao_presenciais, 3000)
    assert.equal(mapped.metrics.domicilio, 400)
    assert.equal(mapped.period, '2026-05')
  })

  it('uses periodo for RH and maps medicos_s_internos → medicos', () => {
    const mapped = mapRecord(fixtures.rh[1], DATASETS_BY_KEY.rh)
    assert.equal(mapped.period, '2015-01')
    assert.equal(mapped.entidade, 'Ação Governativa')
    assert.equal(mapped.metrics.medicos, 0)
    assert.equal(mapped.metrics.at, 6)
    assert.equal(mapped.metrics.ao, 6)
    assert.equal(mapped.metrics.outros, 30)
    assert.equal(mapped.metrics.total, 42)
    assert.equal(mapped.metrics.farmaceuticos, null)
    assert.equal(mapped.metrics.tas, null)
  })

  it('sets period_date to the first of the month UTC', () => {
    const mapped = mapRecord(fixtures.urgencias[0], DATASETS_BY_KEY.urgencias)
    assert.equal(mapped.period_date.toISOString(), '2026-05-01T00:00:00.000Z')
  })

  it('returns null when period or entity is missing', () => {
    const ds = DATASETS_BY_KEY.urgencias
    assert.equal(mapRecord({ instituicao: 'X' }, ds), null)
    assert.equal(mapRecord({ tempo: '2026-05' }, ds), null)
  })
})

describe('parsePeriod / parseGeo', () => {
  it('normalises date-like period values to YYYY-MM', () => {
    assert.equal(parsePeriod('2026-07'), '2026-07')
    assert.equal(parsePeriod('2026-07-01'), '2026-07')
    assert.equal(parsePeriod('2026-07-01T00:00:00+00:00'), '2026-07')
    assert.equal(parsePeriod('bad'), null)
  })

  it('parses {lon,lat} and [lat,lon] geo values', () => {
    assert.deepEqual(parseGeo({ lon: -8.7, lat: 39.2 }), {
      type: 'Point',
      coordinates: [-8.7, 39.2]
    })
    assert.deepEqual(parseGeo([39.2, -8.7]), {
      type: 'Point',
      coordinates: [-8.7, 39.2]
    })
    assert.equal(parseGeo(null), null)
  })
})

describe('slugify used by mapper', () => {
  it('produces entidade_slug from instituicao', () => {
    const mapped = mapRecord(fixtures.urgencias[0], DATASETS_BY_KEY.urgencias)
    assert.equal(mapped.entidade_slug, slugify(mapped.entidade))
    assert.equal(mapped.entidade_slug, 'unidade-local-de-saude-da-leziria-epe')
  })
})
