import Fastify from 'fastify'
import { snsRoutes } from './routes.js'
import { metaRoutes } from './meta.js'
import { SERVICE_NAME, VERSION } from './config.js'

export { SERVICE_NAME, VERSION }

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger === false
      ? false
      : {
          transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined
        }
  })

  app.get('/health', async () => ({
    status:    'ok',
    service:   SERVICE_NAME,
    version:   VERSION,
    timestamp: new Date().toISOString()
  }))

  await app.register(metaRoutes)
  await app.register(snsRoutes, { prefix: '/sns' })

  return app
}
