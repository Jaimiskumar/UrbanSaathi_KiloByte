import mongoose from 'mongoose';

const roadMasterSchema = new mongoose.Schema(
  {
    kgisRoadCentrelineId: { type: String, required: true, unique: true, index: true },
    departmentCode: String,
    roadType: String,
    roadSurface: String,
    roadClass: String,
    kgisWardId: String,
    geometry: {
      type: { type: String, enum: ['LineString'], required: true },
      coordinates: { type: [[Number]], required: true }
    },
    source: { type: String, default: 'KGIS' },
    sourceVersion: String
  },
  { timestamps: true }
);

roadMasterSchema.index({ geometry: '2dsphere' });

export default mongoose.model('RoadMaster', roadMasterSchema);