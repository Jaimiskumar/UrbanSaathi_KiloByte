import mongoose from 'mongoose';

const watchlistRecordSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['STOLEN_VEHICLE', 'BLACKLISTED_VEHICLE', 'WANTED_VEHICLE', 'MISSING_PERSON', 'SUSPECT', 'VIP', 'EMERGENCY', 'CUSTOM'],
    required: true
  },
  identifier: { type: String, index: true },
  plateNumber: { type: String, index: true },
  personName: String,
  vehicleDescription: String,
  reason: String,
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  createdBy: String
}, { timestamps: true });

export default mongoose.model('WatchlistRecord', watchlistRecordSchema);