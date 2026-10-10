import mongoose from 'mongoose';

const roadWorkHistorySchema = new mongoose.Schema(
  {
    bbmpSegmentId: { type: String, required: true, index: true },
    streetId: String,
    streetName: String,
    ward: String,
    wardName: String,
    zone: String,
    landmark: String,
    totalLengthM: Number,
    contractorName: String,
    contractorRegistrationNo: String,
    contractorPhone: String,
    workName: String,
    sanctionedAmount: Number,
    sanctionedYear: Number,
    workYear: Number,
    workType: String,
    otherWorkType: String,
    jobWorkCode: String,
    workOrderNo: String,
    workOrderDate: Date,
    inspectionDate: Date,
    sourcePdf: String
  },
  { timestamps: true }
);

export default mongoose.model('RoadWorkHistory', roadWorkHistorySchema);