import mongoose from 'mongoose'

const datasetStateSchema = new mongoose.Schema({
  key:            { type: String, required: true, unique: true },
  dataset_id:     { type: String, required: true },
  data_processed: { type: String, default: null },
  records:        { type: Number, default: 0 },
  period_from:    { type: String, default: null },
  period_to:      { type: String, default: null },
  last_checked:   { type: Date, default: null },
  last_changed:   { type: Date, default: null },
  last_error:     { type: String, default: null }
}, { collection: 'datasets_state' })

export const DatasetState = mongoose.model('DatasetState', datasetStateSchema)
