import mongoose from 'mongoose';

const sentinelEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  source: { type: String, default: 'DEMO' },
  cameraId: { type: String, index: true },
  vehicleId: { type: String, index: true },
  plateNumber: { type: String, index: true },
  roadId: String,
  intersectionId: String,
  location: {
    latitude: Number,
    longitude: Number,
    label: String
  },
  timestamp: { type: Date, default: Date.now, index: true },
  confidence: { type: Number, min: 0, max: 1, default: 0.95 },
  severity: { type: String, enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'INFO' },
  metadata: mongoose.Schema.Types.Mixed,
  evidence: mongoose.Schema.Types.Mixed,
  status: { type: String, default: 'NEW' }
}, { timestamps: true });

export default mongoose.model('SentinelEvent', sentinelEventSchema);