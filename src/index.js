import mongoose from 'mongoose'
import cron from 'node-cron'
import { buildApp } from './app.js'
import { syncAll, hasEverSynced } from './sync.js'
import { Record } from './models/record.js'
import { Entity } from './models/entity.js'
import { DatasetState } from './models/datasetState.js'
import { SERVICE_NAME, PORT, MONGO_URI, CRON_EXPR } from './config.js'

const app = await buildApp()

cron.schedule(CRON_EXPR, async () => {
  app.log.info('Cron: syncing SNS Transparência datasets...')
  try {
    const r = await syncAll(app.log)
    app.log.info({ r }, 'SNS sync complete')
  } catch (err) {
    app.log.error({ err }, 'SNS sync failed')
  }
})

await mongoose.connect(MONGO_URI)
await Promise.all([
  Record.syncIndexes(),
  Entity.syncIndexes(),
  DatasetState.syncIndexes()
])
app.log.info('Connected to MongoDB')

if (await hasEverSynced()) {
  app.log.info('SNS already synced, skipping startup ingest')
} else {
  app.log.info('No previous SNS sync, running initial ingest...')
  syncAll(app.log)
    .then(r => app.log.info({ r }, 'Initial SNS sync done'))
    .catch(err => app.log.error({ err }, 'Initial SNS sync failed'))
}

await app.listen({ port: PORT, host: '0.0.0.0' })
app.log.info(`${SERVICE_NAME} listening on port ${PORT}`)
