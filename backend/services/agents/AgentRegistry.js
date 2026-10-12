export const AGENT_REGISTRY = Object.freeze({
  CivicAndRoadHealthAgent: {
    purpose: 'Validate civic and road-condition reports and create civic complaints.',
    capabilities: ['pothole_report', 'road_crack_report', 'tree_hazard_report', 'waterlogging_report', 'encroachment_report'],
    requiredInputs: ['event.location', 'event.detection'],
    dependencies: [],
    models: ['pothole_detector', 'urban_issue_detector'],
    optional: true,
    priority: 60,
    timeoutMs: 10000,
    resources: ['road_context_lookup'],
    fallback: 'Return an explicit agent error; do not create a success-shaped complaint.'
  },
  TrafficAgent: {
    purpose: 'Analyze requested traffic areas and produce signal and hazard-routing advisories.',
    capabilities: ['route_request', 'traffic_analysis', 'road_blockage_response', 'accident_traffic_response', 'emergency_route_support'],
    requiredInputs: ['event.location'],
    dependencies: [],
    models: ['vehicle_detector', 'speed_tracking_detector'],
    optional: true,
    priority: 80,
    timeoutMs: 12000,
    resources: ['traffic_signal_store', 'urbanflow_hazard_broadcast'],
    fallback: 'Return an explicit degraded/error result; never apply signal changes without request approval.'
  },
  AccidentEmergencyAgent: {
    purpose: 'Escalate verified accident and hazard events to emergency response channels.',
    capabilities: ['accident_response', 'hazard_response', 'emergency_escalation'],
    requiredInputs: ['event.location', 'event.detection.severity'],
    dependencies: [],
    models: ['accident_classifier'],
    optional: false,
    priority: 100,
    timeoutMs: 8000,
    resources: ['emergency_notification'],
    fallback: 'Mark mandatory safety execution as failed and preserve the failure in the workflow result.'
  },
  GreenCorridorAgent: {
    purpose: 'Prepare emergency-vehicle signal priority and V2X corridor advisories.',
    capabilities: ['emergency_route_request', 'accident_ambulance_routing'],
    requiredInputs: ['event.route', 'event.vehicleId'],
    dependencies: [],
    models: [],
    optional: false,
    priority: 100,
    timeoutMs: 10000,
    resources: ['signal_priority', 'v2x_broadcast'],
    fallback: 'Mark corridor activation as failed; do not claim the corridor was activated.'
  },
  EncroachmentAgent: {
    purpose: 'Validate vendor, hawker, and illegal-parking evidence.',
    capabilities: ['encroachment_report', 'vendor_report', 'illegal_parking_validation'],
    requiredInputs: ['event.detection.confidence', 'event.evidence'],
    dependencies: [],
    models: ['vendor_detector', 'plate_detector'],
    optional: true,
    priority: 50,
    timeoutMs: 10000,
    resources: ['evidence_validation'],
    fallback: 'Return REVIEW_REQUIRED or an explicit agent error; do not issue a violation without evidence.'
  },
  EnforcementAgent: {
    purpose: 'Validate traffic violations against evidence and rule thresholds.',
    capabilities: ['overspeeding', 'helmet_violation', 'rash_driving', 'signal_violation', 'illegal_parking'],
    requiredInputs: ['event.eventType', 'event.detection', 'event.evidence'],
    dependencies: [],
    models: ['speed_detector', 'helmet_detector', 'plate_detector'],
    optional: true,
    priority: 40,
    timeoutMs: 10000,
    resources: ['violation_evidence'],
    fallback: 'Return REVIEW_REQUIRED or an explicit agent error; do not infer missing evidence.'
  },
  EChallanAgent: {
    purpose: 'Create a persisted challan only for a validated violation candidate.',
    capabilities: ['validated_violation_challan'],
    requiredInputs: ['event.candidate.vehicleNumber', 'event.candidate.type'],
    dependencies: ['EnforcementAgent or EncroachmentAgent must return a validated candidate.'],
    models: [],
    optional: true,
    priority: 30,
    timeoutMs: 15000,
    resources: ['challan_store'],
    fallback: 'Return an explicit failure when challan persistence fails.'
  },
  AuthorityCoordinationAgent: {
    purpose: 'Dispatch authority tickets for complaints produced by specialist agents.',
    capabilities: ['civic_complaint_dispatch', 'traffic_recommendation_dispatch'],
    requiredInputs: ['event.complaints'],
    dependencies: ['CivicAndRoadHealthAgent or TrafficAgent must produce a dispatchable item.'],
    models: [],
    optional: true,
    priority: 30,
    timeoutMs: 10000,
    resources: ['authority_dispatch'],
    fallback: 'Return an explicit failure; preserve the complaint for retry or manual handling.'
  },
  VerificationAgent: {
    purpose: 'Verify results and failures from agents that ran in this workflow.',
    capabilities: ['workflow_verification', 'safety_workflow_audit'],
    requiredInputs: ['event.workflowResults'],
    dependencies: ['At least one selected agent or a mandatory dependency failure.'],
    models: [],
    optional: false,
    priority: 90,
    timeoutMs: 8000,
    resources: ['workflow_trace'],
    fallback: 'Mark workflow verification failed; never report an unverified workflow as complete.'
  }
});

export const FEATURE_AGENT_POLICY = Object.freeze({
  route_request: {
    agents: ['TrafficAgent'],
    reasons: { TrafficAgent: 'Traffic analysis is the existing route/traffic planning capability.' },
    domainServices: []
  },
  pothole_report: {
    agents: ['CivicAndRoadHealthAgent'],
    reasons: { CivicAndRoadHealthAgent: 'Civic validation and complaint creation are required for a pothole report.' },
    domainServices: []
  },
  parking_request: {
    agents: [],
    reasons: {},
    domainServices: ['ParkingSpot', 'ParkingBooking']
  },
  accident_response: {
    agents: ['AccidentEmergencyAgent', 'TrafficAgent'],
    reasons: {
      AccidentEmergencyAgent: 'Incident escalation is mandatory for an accident or critical hazard.',
      TrafficAgent: 'Traffic diversion and hazard advisories are mandatory for an accident response.'
    },
    domainServices: []
  },
  emergency_route: {
    agents: ['GreenCorridorAgent', 'TrafficAgent'],
    reasons: {
      GreenCorridorAgent: 'Emergency vehicle signal priority is mandatory for emergency routing.',
      TrafficAgent: 'Traffic safety analysis and route advisories are mandatory for an emergency route.'
    },
    domainServices: []
  },
  waterlogging_response: {
    agents: ['CivicAndRoadHealthAgent', 'TrafficAgent'],
    reasons: {
      CivicAndRoadHealthAgent: 'The road hazard must be triaged as a civic issue.',
      TrafficAgent: 'Waterlogging may require traffic diversion and hazard advisories.'
    },
    domainServices: []
  },
  encroachment_report: {
    agents: ['EncroachmentAgent', 'CivicAndRoadHealthAgent'],
    reasons: {
      EncroachmentAgent: 'The evidence must be checked for an encroachment violation.',
      CivicAndRoadHealthAgent: 'Validated civic encroachment reports require a civic complaint.'
    },
    domainServices: []
  },
  illegal_parking_response: {
    agents: ['EncroachmentAgent', 'EnforcementAgent'],
    reasons: {
      EncroachmentAgent: 'Check parking evidence, plate identity, and stationary duration.',
      EnforcementAgent: 'Validate the parking violation against the enforcement rule.'
    },
    domainServices: []
  },
  violation_review: {
    agents: ['EnforcementAgent'],
    reasons: { EnforcementAgent: 'The requested violation requires evidence and rule validation.' },
    domainServices: []
  },
  traffic_analysis: {
    agents: ['TrafficAgent'],
    reasons: { TrafficAgent: 'Traffic analysis was explicitly requested.' },
    domainServices: []
  },
  unsupported: { agents: [], reasons: {}, domainServices: [] }
});
