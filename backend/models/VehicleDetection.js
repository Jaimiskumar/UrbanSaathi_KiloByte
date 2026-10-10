import mongoose from 'mongoose';

const vehicleDetectionSchema = new mongoose.Schema({
  vehicleTrackId: { type: String, required: true, index: true },
  cameraId: { type: String, required: true, index: true },
  plateNumber: { type: String, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  boundingBox: {
    x1: Number,
    y1: Number,
    x2: Number,
    y2: Number
  },
  vehicleType: { type: String, default: 'car' },
  color: String,
  confidence: { type: Number, min: 0, max: 1, default: 0.95 },
  latitude: Number,
  longitude: Number,
  roadId: String,
  intersectionId: String,
  source: { type: String, default: 'DEMO' },
  evidence: mongoose.Schema.Types.Mixed
}, { timestamps: true });

vehicleDetectionSchema.index({ plateNumber: 1, timestamp: -1 });

export default mongoose.model('VehicleDetection', vehicleDetectionSchema);