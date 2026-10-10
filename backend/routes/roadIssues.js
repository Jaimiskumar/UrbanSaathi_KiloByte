import express from 'express';
import RoadIssue from '../models/RoadIssue.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { io } from '../server.js';
import { logAudit } from '../services/auditLogger.js';
import { lookupRoad } from '../services/roadIntelligenceService.js';
import IssueVerification from '../models/IssueVerification.js';

const router = express.Router();

router.get('/my-issues', authMiddleware, async (req, res) => {
  try {
    const issues = await RoadIssue.find({ userId: req.user.userId }).sort({ reportedAt: -1 });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', authMiddleware, requirePermission('road-issues:read'), async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.issueType = type;

    const issues = await RoadIssue.find(filter).populate('userId', 'name email phone').sort({ reportedAt: -1 });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { issueType, locationName, coordinates, description, imageUrl } = req.body;

    if (!issueType || !locationName || !coordinates) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const roadIntelligence = await lookupRoad({ coordinates, issueType });
    const priority = roadIntelligence.priority || { level: 'MEDIUM', score: 0 };
    const aiRecommendation = issueType === 'Roadblock' || issueType === 'Under Construction'
      ? 'Notify the traffic authority and evaluate a diversion.'
      : priority.level === 'HIGH' || priority.level === 'CRITICAL'
        ? 'Prioritize field inspection and create a maintenance complaint.'
        : 'Create a road maintenance complaint and schedule verification.';

    const newIssue = new RoadIssue({
      userId: req.user.userId,
      issueType,
      locationName,
      coordinates,
      description,
      imageUrl: imageUrl || '',
      roadIntelligence,
      priority: priority.level,
      riskScore: priority.score,
      aiRecommendation,
      status: 'Reported'
    });

    // S.I.T.A. Automated Logic (Agent USP)
    // If pothole is reported, SITA automatically assigns it to 'Verification' phase
    if (issueType === 'Pothole') {
      newIssue.status = 'Verification';
    }

    await newIssue.save();

    // Emit socket event for real-time notification to all
    io.emit('new-road-issue', {
      issueId: newIssue._id,
      type: issueType,
      location: locationName,
      status: newIssue.status,
      timestamp: new Date()
    });

    const isClosure = issueType === 'Roadblock' || issueType === 'Under Construction';
    const incidentAlert = {
      incidentId: newIssue._id.toString(),
      incidentType: isClosure ? 'road_closure' : issueType.toLowerCase().replace(/ /g, '_'),
      title: `${issueType}: ${locationName}`,
      location: locationName,
      coordinates,
      severity: isClosure ? 'HIGH' : 'MEDIUM',
      source: 'citizen_report',
      authority: isClosure ? 'Bengaluru Traffic Police Control Room' : 'BBMP Roads & Infrastructure',
      authorityAction: isClosure ? 'Traffic diversion requested' : 'Inspection and maintenance work order requested',
      routeAction: isClosure ? 'REROUTE_REQUIRED' : 'CAUTION_REQUIRED',
      alternateRoute: isClosure ? 'Use the nearest parallel corridor until this road reopens' : 'Reduce speed and keep a safe following distance',
      reportedAt: newIssue.reportedAt
    };

    io.emit('traffic_incident_alert', incidentAlert);
    io.emit('admin_incident_alert', incidentAlert);

    await logAudit({
      req,
      action: 'roadIssue.report',
      resourceType: 'road_issue',
      resourceId: newIssue._id.toString(),
      metadata: { issueType, locationName }
    });

    res.status(201).json(newIssue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/status', authMiddleware, requirePermission('road-issues:write'), async (req, res) => {
  try {
    const { status } = req.body;
    const updatedIssue = await RoadIssue.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status,
          ...(status === 'Resolved' ? { resolvedAt: new Date() } : {}) 
        } 
      },
      { new: true }
    );

    if (!updatedIssue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    await logAudit({
      req,
      action: 'roadIssue.statusUpdate',
      resourceType: 'road_issue',
      resourceId: req.params.id,
      metadata: { newStatus: status }
    });

    io.emit('road-issue-updated', {
      issueId: updatedIssue._id,
      newStatus: status,
      location: updatedIssue.locationName
    });

    res.json(updatedIssue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/verify', authMiddleware, requirePermission('road-issues:write'), async (req, res) => {
  try {
    const { result, coordinates, evidenceReference, notes } = req.body;
    if (!['Verified Resolved', 'Issue Still Present'].includes(result)) {
      return res.status(400).json({ message: 'Verification result must be Verified Resolved or Issue Still Present' });
    }

    const issue = await RoadIssue.findByIdAndUpdate(
      req.params.id,
      { $set: { status: result, ...(result === 'Verified Resolved' ? { resolvedAt: new Date() } : {}) } },
      { new: true }
    );
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const verification = await IssueVerification.create({
      roadIssueId: issue._id,
      result,
      coordinates,
      evidenceReference,
      notes,
      verifiedBy: req.user.userId
    });
    io.emit('road-issue-updated', { issueId: issue._id, newStatus: result, location: issue.locationName });
    res.json({ issue, verification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
