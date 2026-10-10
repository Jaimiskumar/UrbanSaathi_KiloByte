import mongoose from 'mongoose';

const sentinelAlertSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SentinelEvent', required: true, index: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM', index: true },
  confidence: Number,
  title: String,
  description: String,
  location: { latitude: Number, longitude: Number, label: String },
  cameraId: { type: String, index: true },
  vehicleId: String,
  plateNumber: { type: String, index: true },
  authority: { type: String, default: 'Police' },
  priority: { type: String, default: 'HIGH' },
  recommendedAction: String,
  status: { type: String, enum: ['NEW', 'ACKNOWLEDGED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'NEW', index: true },
  acknowledgedAt: Date,
  resolvedAt: Date
}, { timestamps: true });

export default mongoose.model('SentinelAlert', sentinelAlertSchema);