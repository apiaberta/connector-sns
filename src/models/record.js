import mongoose from 'mongoose'

const recordSchema = new mongoose.Schema({
  dataset:       { type: String, required: true },
  period:        { type: String, required: true },
  period_date:   { type: Date, required: true },
  regiao:        { type: String, default: null },
  entidade:      { type: String, required: true },
  entidade_slug: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }
  },
  metrics:   { type: mongoose.Schema.Types.Mixed, default: {} },
  synced_at: { type: Date, default: Date.now }
}, { collection: 'records' })

recordSchema.index({ dataset: 1, entidade_slug: 1, period: 1 }, { unique: true })
recordSchema.index({ dataset: 1, period: -1 })
recordSchema.index({ dataset: 1, regiao: 1, period: -1 })
recordSchema.index({ location: '2dsphere' }, { sparse: true })

export const Record = mongoose.model('Record', recordSchema)
