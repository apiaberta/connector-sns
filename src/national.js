import { getDataset } from './datasets.js'
import { Record } from './models/record.js'

const cache = new Map()

export function clearNationalCache(key) {
  if (key) cache.delete(key)
  else cache.clear()
}

/** Recompute ratio metrics from summed numerators/denominators. Never average. */
export function recomputeRatios(sums, dataset) {
  const out = { ...sums }
  for (const [name, spec] of Object.entries(dataset.ratios || {})) {
    const num = sums[spec.numerator]
    const den = sums[spec.denominator]
    const scale = spec.scale ?? 1
    if (num == null || den == null || den === 0) {
      out[name] = null
    } else {
      out[name] = (num / den) * scale
    }
  }
  return out
}

/**
 * Sum count metrics by period, then recompute percentages.
 * `records` is `[{period, metrics}]`.
 */
export function aggregateNational(records, dataset) {
  const ratioKeys = new Set(Object.keys(dataset.ratios || {}))
  const byPeriod = new Map()

  for (const rec of records) {
    if (!rec?.period) continue
    if (!byPeriod.has(rec.period)) byPeriod.set(rec.period, {})
    const acc = byPeriod.get(rec.period)
    const metrics = rec.metrics || rec
    for (const name of Object.values(dataset.metrics)) {
      if (ratioKeys.has(name)) continue
      const v = metrics[name]
      if (typeof v === 'number' && Number.isFinite(v)) {
        acc[name] = (acc[name] || 0) + v
      }
    }
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, sums]) => ({ period, ...recomputeRatios(sums, dataset) }))
}

async function computeNationalFromMongo(key) {
  const ds = getDataset(key)
  if (!ds) return []
  const ratioKeys = new Set(Object.keys(ds.ratios || {}))
  const group = { _id: '$period' }
  for (const name of Object.values(ds.metrics)) {
    if (ratioKeys.has(name)) continue
    group[name] = { $sum: { $ifNull: [`$metrics.${name}`, 0] } }
  }
  const rows = await Record.aggregate([
    { $match: { dataset: key } },
    { $group: group },
    { $sort: { _id: 1 } }
  ])
  return rows.map(({ _id, ...sums }) => ({ period: _id, ...recomputeRatios(sums, ds) }))
}

export async function getNational(key, { desde, ate } = {}) {
  if (!cache.has(key)) {
    cache.set(key, await computeNationalFromMongo(key))
  }
  let rows = cache.get(key)
  if (desde) rows = rows.filter(r => r.period >= desde)
  if (ate) rows = rows.filter(r => r.period <= ate)
  return rows
}
