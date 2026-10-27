export const SERVICE_NAME = 'connector-sns'
export const VERSION = '1.0.0'
export const PORT = parseInt(process.env.PORT || '3020', 10)
export const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apiaberta-sns'

export const SOURCE_NAME = 'Fonte: Portal da Transparência SNS'
export const SOURCE_PORTAL = 'https://transparencia.sns.gov.pt'
export const ODS_BASE = 'https://transparencia.sns.gov.pt/api/explore/v2.1'
export const USER_AGENT = 'apiaberta.pt/1.0 (open-data connector)'
export const MAX_EXPORT_BYTES = 50 * 1024 * 1024
export const SANITY_RATIO = 0.8
export const CRON_EXPR = '20 6 * * *'

export function sourceUrl(datasetId) {
  return `https://transparencia.sns.gov.pt/explore/dataset/${datasetId}/`
}
