/**
 * sync.js — SNS Transparência ingest
 * Daily at 06:20 UTC, plus startup if never synced.
 *
 * For each curated dataset: read catalog metas.default.data_processed;
 * skip the export when unchanged; otherwise full JSON refresh, upsert,
 * then delete stale rows if the new count is ≥ 80% of the previous.
 */

import { DATASETS, selectFields } from './datasets.js'
import { mapRecord } from './mapper.js'
import { Record } from './models/record.js'
import { Entity } from './models/entity.js'
import { DatasetState } from './models/datasetState.js'
import { clearNationalCache } from './national.js'
import { ODS_BASE, USER_AGENT, MAX_EXPORT_BYTES, SANITY_RATIO } from './config.js'

const HEADERS = { 'User-Agent': USER_AGENT }
const CATALOG_TIMEOUT_MS = 15_000
const EXPORT_TIMEOUT_MS = 120_000
const BULK_CHUNK = 500

export function shouldSkip(stored, incoming) {
  return stored != null && incoming != null && String(stored) === String(incoming)
}

export function shouldDeleteStale(newCount, previousCount) {
  if (!previousCount) return true
  return newCount >= previousCount * SANITY_RATIO
}

async function fetchJson(url, fetchImpl, timeoutMs = CATALOG_TIMEOUT_MS) {
  const res = await fetchImpl(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json()
}

export async function fetchCatalog(datasetId, fetchImpl = fetch) {
  return fetchJson(`${ODS_BASE}/catalog/datasets/${datasetId}`, fetchImpl)
}

const ODSQL_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

/** ODSQL select= requires backticks for names that are not plain identifiers (e.g. start with a digit). */
export function quoteSelectField(name) {
  const field = String(name)
  if (ODSQL_IDENT.test(field)) return field
  return `\`${field.replaceAll('`', '``')}\``
}

export function buildSelectClause(fields) {
  return fields.map(quoteSelectField).join(',')
}

export async function fetchExport(datasetId, fields, fetchImpl = fetch) {
  const select = encodeURIComponent(buildSelectClause(fields))
  const url = `${ODS_BASE}/catalog/datasets/${datasetId}/exports/json?select=${select}`
  const res = await fetchImpl(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_EXPORT_BYTES) {
    throw new Error(`Export too large: ${declared} bytes (max ${MAX_EXPORT_BYTES})`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_EXPORT_BYTES) {
    throw new Error(`Export too large: ${buf.length} bytes (max ${MAX_EXPORT_BYTES})`)
  }
  return JSON.parse(buf.toString('utf8'))
}

/**
 * Catalog + optional export. Injectable fetch. Counts as 1 catalog call;
 * export is skipped when data_processed is unchanged.
 */
export async function fetchDatasetUpdate(ds, { fetchImpl = fetch, dataProcessed = null } = {}) {
  const catalog = await fetchCatalog(ds.dataset_id, fetchImpl)
  const incoming = catalog?.metas?.default?.data_processed ?? null
  if (shouldSkip(dataProcessed, incoming)) {
    return { skipped: true, data_processed: incoming, catalog, rows: null }
  }
  const rows = await fetchExport(ds.dataset_id, selectFields(ds), fetchImpl)
  return { skipped: false, data_processed: incoming, catalog, rows }
}

async function bulkUpsert(docs) {
  if (docs.length === 0) return
  for (let i = 0; i < docs.length; i += BULK_CHUNK) {
    const chunk = docs.slice(i, i + BULK_CHUNK)
    const ops = chunk.map(doc => ({
      updateOne: {
        filter: {
          dataset: doc.dataset,
          entidade_slug: doc.entidade_slug,
          period: doc.period
        },
        update: { $set: doc },
        upsert: true
      }
    }))
    await Record.bulkWrite(ops, { ordered: false })
  }
}

export async function rebuildEntities() {
  const grouped = await Record.aggregate([
    { $sort: { synced_at: -1 } },
    {
      $group: {
        _id: '$entidade_slug',
        nome: { $first: '$entidade' },
        regiao: { $first: '$regiao' },
        location: { $first: '$location' },
        datasets: { $addToSet: '$dataset' }
      }
    }
  ])

  if (grouped.length === 0) {
    await Entity.deleteMany({})
    return { entities: 0 }
  }

  const ops = grouped.map(row => ({
    updateOne: {
      filter: { slug: row._id },
      update: {
        $set: {
          slug: row._id,
          nome: row.nome,
          regiao: row.regiao ?? null,
          location: row.location ?? null,
          datasets: row.datasets
        }
      },
      upsert: true
    }
  }))
  for (let i = 0; i < ops.length; i += BULK_CHUNK) {
    await Entity.bulkWrite(ops.slice(i, i + BULK_CHUNK), { ordered: false })
  }
  await Entity.deleteMany({ slug: { $nin: grouped.map(r => r._id) } })
  return { entities: grouped.length }
}

export async function syncDataset(ds, logger, { fetchImpl = fetch, runStart = new Date() } = {}) {
  const state = await DatasetState.findOne({ key: ds.key }).lean()
  const update = await fetchDatasetUpdate(ds, {
    fetchImpl,
    dataProcessed: state?.data_processed ?? null
  })

  if (update.skipped) {
    await DatasetState.updateOne(
      { key: ds.key },
      {
        $set: {
          dataset_id: ds.dataset_id,
          last_checked: new Date(),
          last_error: null
        },
        $setOnInsert: { key: ds.key, records: state?.records ?? 0 }
      },
      { upsert: true }
    )
    logger?.info({ key: ds.key }, 'Unchanged, skip export')
    return { key: ds.key, skipped: true, records: state?.records ?? 0 }
  }

  if (!Array.isArray(update.rows)) {
    throw new Error(`Export for ${ds.key} is not a JSON array`)
  }

  const previousCount = state?.records ?? await Record.countDocuments({ dataset: ds.key })
  const docs = []
  for (const raw of update.rows) {
    const mapped = mapRecord(raw, ds, runStart)
    if (mapped) docs.push(mapped)
  }

  await bulkUpsert(docs)

  let deleted = 0
  if (shouldDeleteStale(docs.length, previousCount)) {
    const result = await Record.deleteMany({
      dataset: ds.key,
      synced_at: { $lt: runStart }
    })
    deleted = result.deletedCount ?? 0
  } else {
    logger?.warn(
      { key: ds.key, newCount: docs.length, previousCount },
      'Sanity guard: skip stale delete'
    )
  }

  const periods = docs.map(d => d.period).sort()
  await DatasetState.updateOne(
    { key: ds.key },
    {
      $set: {
        key: ds.key,
        dataset_id: ds.dataset_id,
        data_processed: update.data_processed,
        records: docs.length,
        period_from: periods[0] ?? null,
        period_to: periods[periods.length - 1] ?? null,
        last_checked: new Date(),
        last_changed: new Date(),
        last_error: null
      }
    },
    { upsert: true }
  )

  clearNationalCache(ds.key)
  logger?.info({ key: ds.key, records: docs.length, deleted }, 'Dataset refresh complete')
  return { key: ds.key, skipped: false, records: docs.length, deleted }
}

export async function hasEverSynced() {
  const n = await DatasetState.countDocuments({ data_processed: { $ne: null } })
  return n > 0
}

export async function syncAll(logger, opts = {}) {
  const runStart = opts.runStart ?? new Date()
  const results = []
  let refreshed = false

  for (const ds of DATASETS) {
    try {
      const r = await syncDataset(ds, logger, { ...opts, runStart })
      results.push(r)
      if (r.skipped === false) refreshed = true
    } catch (err) {
      logger?.error({ err, key: ds.key }, 'Dataset sync failed')
      await DatasetState.updateOne(
        { key: ds.key },
        {
          $set: {
            key: ds.key,
            dataset_id: ds.dataset_id,
            last_checked: new Date(),
            last_error: err.message
          }
        },
        { upsert: true }
      )
      results.push({ key: ds.key, error: err.message })
    }
  }

  if (refreshed) {
    try {
      const entities = await rebuildEntities()
      logger?.info(entities, 'Rebuilt entities')
    } catch (err) {
      logger?.error({ err }, 'Failed to rebuild entities')
    }
    clearNationalCache()
  }

  return results
}
