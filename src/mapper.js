export class QueryError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = 'QueryError'
    this.statusCode = statusCode
  }
}

/** Lowercase, de-accented, non-alphanumerics collapsed to '-'. */
export function slugify(value) {
  if (value == null) return null
  const slug = String(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || null
}

export function parsePeriod(value) {
  if (value == null || value === '') return null
  const m = String(value).trim().match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return `${m[1]}-${m[2]}`
}

export function periodDate(period) {
  const parsed = parsePeriod(period)
  if (!parsed) return null
  return new Date(`${parsed}-01T00:00:00.000Z`)
}

export function parseNumber(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function parseGeo(value) {
  if (!value || typeof value !== 'object') return null
  let lon
  let lat
  if (Array.isArray(value) && value.length >= 2) {
    // Opendatasoft geo_point_2d arrays are [lat, lon]
    lat = parseNumber(value[0])
    lon = parseNumber(value[1])
  } else {
    lon = parseNumber(value.lon ?? value.lng)
    lat = parseNumber(value.lat)
  }
  if (lon == null || lat == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { type: 'Point', coordinates: [lon, lat] }
}

export function parseNear(value) {
  const parts = String(value).split(',')
  if (parts.length !== 2) {
    throw new QueryError('Invalid near, expected lat,lon')
  }
  const lat = parseNumber(parts[0]?.trim())
  const lon = parseNumber(parts[1]?.trim())
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new QueryError('Invalid near, expected lat,lon')
  }
  return { lat, lon }
}

export function parsePagination(query = {}) {
  const limitRaw = parseNumber(query.limit)
  const offsetRaw = parseNumber(query.offset)
  const limit = Math.min(Math.max(limitRaw == null ? 100 : Math.trunc(limitRaw), 1), 1000)
  const offset = Math.max(offsetRaw == null ? 0 : Math.trunc(offsetRaw), 0)
  return { limit, offset }
}

export function parseSort(value) {
  if (!value || value === '-period') return { period: -1 }
  if (value === 'period') return { period: 1 }
  throw new QueryError('Invalid sort, expected period or -period')
}

export function assertPeriodParam(value, name) {
  if (value == null || value === '') return null
  const period = parsePeriod(value)
  if (!period || period !== String(value).trim()) {
    throw new QueryError(`Invalid ${name}, expected YYYY-MM`)
  }
  return period
}

export function mapMetrics(raw, ds) {
  const metrics = {}
  for (const [src, dst] of Object.entries(ds.metrics)) {
    metrics[dst] = parseNumber(raw?.[src])
  }
  return metrics
}

/**
 * Map one Opendatasoft row to our record shape (without _id).
 * Returns null when period or entity is missing.
 */
export function mapRecord(raw, ds, syncedAt = new Date()) {
  if (!raw || !ds) return null
  const period = parsePeriod(raw[ds.period_field])
  const entidade = raw[ds.entity_field] == null ? null : String(raw[ds.entity_field]).trim()
  const entidade_slug = slugify(entidade)
  if (!period || !entidade_slug) return null

  return {
    dataset: ds.key,
    period,
    period_date: periodDate(period),
    regiao: raw.regiao == null || raw.regiao === '' ? null : String(raw.regiao),
    entidade,
    entidade_slug,
    location: parseGeo(raw[ds.geo_field]),
    metrics: mapMetrics(raw, ds),
    synced_at: syncedAt
  }
}

export function formatRecord(doc) {
  if (!doc) return null
  return {
    period: doc.period,
    regiao: doc.regiao ?? null,
    entidade: doc.entidade,
    entidade_slug: doc.entidade_slug,
    location: doc.location ?? null,
    ...(doc.metrics || {})
  }
}
