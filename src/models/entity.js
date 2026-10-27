import mongoose from 'mongoose'

const entitySchema = new mongoose.Schema({
  slug:     { type: String, required: true, unique: true },
  nome:     { type: String, required: true },
  regiao:   { type: String, default: null },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }
  },
  datasets: { type: [String], default: [] }
}, { collection: 'entities' })

entitySchema.index({ location: '2dsphere' }, { sparse: true })
entitySchema.index({ regiao: 1 })

export const Entity = mongoose.model('Entity', entitySchema)
