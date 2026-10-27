import { DATASETS, DATASET_KEYS, getDataset, metricNames, datasetSourceUrl } from './datasets.js'
import { DatasetState } from './models/datasetState.js'
import { Record } from './models/record.js'
import { Entity } from './models/entity.js'
import { getNational } from './national.js'
import {
  QueryError,
  formatRecord,
  parseNear,
  parsePagination,
  parseSort,
  assertPeriodParam
} from './mapper.js'

const YYYY_MM = '^[0-9]{4}-[0-9]{2}$'

const datasetQuerystring = {
  type: 'object',
  properties: {
    entidade: { type: 'string' },
    regiao:   { type: 'string' },
    desde:    { type: 'string', pattern: YYYY_MM },
    ate:      { type: 'string', pattern: YYYY_MM },
    limit:    { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
    offset:   { type: 'integer', default: 0, minimum: 0 },
    sort:     { type: 'string', default: '-period', enum: ['period', '-period'] }
  }
}

const datasetParams = {
  type: 'object',
  properties: {
    dataset: { type: 'string', enum: DATASET_KEYS }
  },
  required: ['dataset']
}

export function formatDatasetList(states = []) {
  const byKey = Object.fromEntries(states.map(s => [s.key, s]))
  return DATASETS.map(ds => {
    const st = byKey[ds.key] || {}
    return {
      key:          ds.key,
      dataset_id:   ds.dataset_id,
      title:        ds.title_pt,
      description:  ds.description_pt,
      metrics:      metricNames(ds),
      period_from:  st.period_from ?? null,
      period_to:    st.period_to ?? null,
      records:      st.records ?? 0,
      last_changed: st.last_changed ?? null,
      source_url:   datasetSourceUrl(ds)
    }
  })
}

function recordFilter(dataset, query = {}) {
  const filter = { dataset }
  if (query.entidade) filter.entidade_slug = query.entidade
  if (query.regiao) filter.regiao = query.regiao
  const period = {}
  const desde = assertPeriodParam(query.desde, 'desde')
  const ate = assertPeriodParam(query.ate, 'ate')
  if (desde) period.$gte = desde
  if (ate) period.$lte = ate
  if (Object.keys(period).length) filter.period = period
  return filter
}

export async function snsRoutes(app) {

  // GET /sns/datasets — registered before /:dataset
  app.get('/datasets', {
    schema: {
      description: 'Curated SNS Transparência datasets and sync state',
      tags: ['SNS']
    }
  }, async () => {
    const states = await DatasetState.find().lean()
    return formatDatasetList(states)
  })

  // GET /sns/entidades
  app.get('/entidades', {
    schema: {
      description: 'SNS institutions / CSP entities',
      tags: ['SNS'],
      querystring: {
        type: 'object',
        properties: {
          q:      { type: 'string' },
          regiao: { type: 'string' },
          near:   { type: 'string', description: 'lat,lon of search centre' },
          radius: { type: 'number', description: 'Search radius in km (max 500)', maximum: 500 }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const filter = {}
      if (req.query.q) filter.nome = new RegExp(req.query.q, 'i')
      if (req.query.regiao) filter.regiao = req.query.regiao
      if (req.query.near) {
        const { lat, lon } = parseNear(req.query.near)
        let radiusKm = req.query.radius == null || req.query.radius === ''
          ? 50
          : Number(req.query.radius)
        if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
          throw new QueryError('Invalid radius')
        }
        if (radiusKm > 500) radiusKm = 500
        filter.location = {
          $geoWithin: {
            $centerSphere: [[lon, lat], radiusKm / 6371]
          }
        }
      }
      const data = await Entity.find(filter).sort({ nome: 1 }).lean()
      return {
        count: data.length,
        data: data.map(e => ({
          slug:     e.slug,
          nome:     e.nome,
          regiao:   e.regiao ?? null,
          location: e.location ?? null,
          datasets: e.datasets || []
        }))
      }
    } catch (err) {
      if (err instanceof QueryError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })

  // GET /sns/entidades/:slug
  app.get('/entidades/:slug', {
    schema: {
      description: 'One SNS entity plus the latest month of every dataset',
      tags: ['SNS'],
      params: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug']
      }
    }
  }, async (req, reply) => {
    const entity = await Entity.findOne({ slug: req.params.slug }).lean()
    if (!entity) {
      return reply.code(404).send({ error: `Entity ${req.params.slug} not found` })
    }

    const latest = {}
    await Promise.all(DATASET_KEYS.map(async (key) => {
      const doc = await Record.findOne({ dataset: key, entidade_slug: entity.slug })
        .sort({ period: -1 })
        .lean()
      latest[key] = doc ? formatRecord(doc) : null
    }))

    return {
      slug:     entity.slug,
      nome:     entity.nome,
      regiao:   entity.regiao ?? null,
      location: entity.location ?? null,
      datasets: entity.datasets || [],
      latest
    }
  })

  app.get('/:dataset/latest', {
    schema: {
      description: 'Latest period for every entity in a dataset',
      tags: ['SNS'],
      params: datasetParams,
      querystring: {
        type: 'object',
        properties: {
          regiao: { type: 'string' }
        }
      }
    }
  }, async (req) => {
    const match = { dataset: req.params.dataset }
    if (req.query.regiao) match.regiao = req.query.regiao

    const rows = await Record.aggregate([
      { $match: match },
      { $sort: { period: -1 } },
      { $group: { _id: '$entidade_slug', doc: { $first: '$$ROOT' } } }
    ])

    const data = rows.map(r => formatRecord(r.doc))
    const period = data.reduce((max, row) => (!max || row.period > max ? row.period : max), null)
    data.sort((a, b) => a.entidade.localeCompare(b.entidade, 'pt'))

    return { period, count: data.length, data }
  })

  app.get('/:dataset/national', {
    schema: {
      description: 'Monthly national totals. Percentages are recomputed, never averaged.',
      tags: ['SNS'],
      params: datasetParams,
      querystring: {
        type: 'object',
        properties: {
          desde: { type: 'string', pattern: YYYY_MM },
          ate:   { type: 'string', pattern: YYYY_MM }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const desde = assertPeriodParam(req.query.desde, 'desde')
      const ate = assertPeriodParam(req.query.ate, 'ate')
      const data = await getNational(req.params.dataset, { desde, ate })
      return { count: data.length, data }
    } catch (err) {
      if (err instanceof QueryError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })

  app.get('/:dataset', {
    schema: {
      description: 'Monthly records for a curated SNS dataset',
      tags: ['SNS'],
      params: datasetParams,
      querystring: datasetQuerystring
    }
  }, async (req, reply) => {
    if (!getDataset(req.params.dataset)) {
      return reply.code(400).send({ error: `Unknown dataset ${req.params.dataset}` })
    }
    try {
      const filter = recordFilter(req.params.dataset, req.query)
      const { limit, offset } = parsePagination(req.query)
      const sort = parseSort(req.query.sort)
      const [total, docs] = await Promise.all([
        Record.countDocuments(filter),
        Record.find(filter).sort(sort).skip(offset).limit(limit).lean()
      ])
      return {
        count: docs.length,
        total,
        data: docs.map(formatRecord)
      }
    } catch (err) {
      if (err instanceof QueryError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }
  })
}
