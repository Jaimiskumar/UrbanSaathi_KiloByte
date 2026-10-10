import mongoose from 'mongoose';

const roadMatchSchema = new mongoose.Schema(
  {
    kgisRoadCentrelineId: { type: String, required: true, index: true },
    bbmpSegmentId: { type: String, required: true, index: true },
    streetName: String,
    ward: String,
    zone: String,
    matchConfidence: { type: Number, min: 0, max: 1, required: true },
    matchMethod: { type: String, enum: ['verified', 'manual', 'candidate'], default: 'verified' },
    source: { type: String, default: 'road_match' }
  },
  { timestamps: true }
);

roadMatchSchema.index({ kgisRoadCentrelineId: 1, bbmpSegmentId: 1 }, { unique: true });

export default mongoose.model('RoadMatch', roadMatchSchema);