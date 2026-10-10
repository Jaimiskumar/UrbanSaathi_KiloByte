import mongoose from 'mongoose';

const issueVerificationSchema = new mongoose.Schema(
  {
    roadIssueId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoadIssue', required: true, index: true },
    result: { type: String, enum: ['Verified Resolved', 'Issue Still Present'], required: true },
    coordinates: { lat: Number, lng: Number },
    evidenceReference: String,
    notes: String,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('IssueVerification', issueVerificationSchema);