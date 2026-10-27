import { SERVICE_NAME, VERSION, SOURCE_NAME, SOURCE_PORTAL, CRON_EXPR } from './config.js'
import { DATASETS, datasetSourceUrl } from './datasets.js'
import { DatasetState } from './models/datasetState.js'
import { Record } from './models/record.js'
import { Entity } from './models/entity.js'

export async function metaRoutes(app) {
  app.get('/sns/meta', {
    schema: {
      description: 'Metadata and stats for the SNS Transparência connector',
      tags: ['SNS']
    }
  }, async () => {
    const [recordCount, entityCount, lastState] = await Promise.all([
      Record.countDocuments(),
      Entity.countDocuments(),
      DatasetState.findOne().sort({ last_checked: -1 }).lean()
    ])
    return {
      connector:   SERVICE_NAME,
      version:     VERSION,
      description: 'Curated monthly SNS Transparência datasets (urgências, cirurgia, consultas, RH)',
      source:      SOURCE_PORTAL,
      attribution: SOURCE_NAME,
      update_freq: `daily ${CRON_EXPR}`,
      license:     null,
      endpoints: [
        { path: '/v1/sns/datasets',              description: 'Curated datasets and sync state' },
        { path: '/v1/sns/:dataset',              description: 'Monthly records (filterable)' },
        { path: '/v1/sns/:dataset/latest',       description: 'Latest period per entity' },
        { path: '/v1/sns/:dataset/national',     description: 'Monthly national totals' },
        { path: '/v1/sns/entidades',             description: 'Institutions / CSP entities' },
        { path: '/v1/sns/entidades/:slug',       description: 'One entity plus latest month of every dataset' },
        { path: '/v1/sns/meta',                  description: 'Connector metadata' }
      ],
      datasets: DATASETS.map(ds => ({
        key:        ds.key,
        dataset_id: ds.dataset_id,
        title:      ds.title_pt,
        source_url: datasetSourceUrl(ds)
      })),
      stats: {
        records:     recordCount,
        entities:    entityCount,
        last_checked: lastState?.last_checked ?? null,
        last_changed: lastState?.last_changed ?? null
      }
    }
  })
}
