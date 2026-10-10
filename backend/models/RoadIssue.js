import mongoose from 'mongoose';

const roadIssueSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    issueType: {
      type: String,
      required: true,
      enum: ['Pothole', 'Under Construction', 'Roadblock', 'Damaged Signage', 'Water Logging', 'Fallen Tree', 'Encroachment', 'Accident', 'Other']
    },
    locationName: {
      type: String,
      required: true
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    description: {
      type: String,
      default: ''
    },
    imageUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Reported', 'Assigned', 'Verification', 'In Progress', 'Resolved', 'Verified Resolved', 'Issue Still Present', 'Rejected'],
      default: 'Reported',
      index: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    roadIntelligence: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    aiRecommendation: {
      type: String,
      default: ''
    },
    source: {
      type: String,
      enum: ['citizen_report', 'camera_ml', 'file_upload', 'demo_road_intelligence'],
      default: 'citizen_report',
      index: true
    },
    agentWorkflow: {
      eventId: { type: String, index: true },
      selectedAgents: { type: [String], default: [] },
      completedAt: Date,
      status: { type: String, default: 'PENDING' },
      authorityStatus: { type: String, default: 'PENDING' },
      authorityTicketId: String,
      authorityId: String,
      department: String,
      authorityJurisdiction: String,
      contractorName: String,
      contractorId: String,
      contractorContact: String,
      contractorPerformanceScore: Number,
      slaHours: Number,
      mlConfidence: Number,
      dispatches: { type: mongoose.Schema.Types.Mixed, default: [] }
    }
  },
  {
    timestamps: true
  }
);

roadIssueSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

export default mongoose.model('RoadIssue', roadIssueSchema);
