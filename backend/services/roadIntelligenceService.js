import RoadMaster from '../models/RoadMaster.js';
import RoadMatch from '../models/RoadMatch.js';
import RoadWorkHistory from '../models/RoadWorkHistory.js';
import { predictContractor } from './contractorPredictionService.js';

const UNAVAILABLE_MESSAGE = 'Road identified, but verified BBMP road-history information is unavailable.';

function validateCoordinates(coordinates) {
  const lat = Number(coordinates?.lat);
  const lng = Number(coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Valid latitude and longitude are required');
  }
  return { lat, lng };
}

function calculatePriority({ issueType, road, history }) {
  let score = 20;
  const typeWeights = { Pothole: 30, Roadblock: 40, 'Water Logging': 30, 'Under Construction': 25 };
  score += typeWeights[issueType] || 15;
  if (['highway', 'arterial', 'main'].includes(String(road?.roadClass || '').toLowerCase())) score += 20;
  if (history?.inspectionDate && new Date(history.inspectionDate) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) score += 10;
  score = Math.min(score, 100);
  return { score, level: score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW' };
}

export async function lookupRoad({ coordinates, issueType = 'Other' }) {
  const point = validateCoordinates(coordinates);
  let road;

  try {
    const nearestRoads = await RoadMaster.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [point.lng, point.lat] },
          key: 'geometry',
          distanceField: 'distanceFromRoadMeters',
          maxDistance: 5000,
          spherical: true
        }
      },
      { $limit: 1 }
    ]);
    road = nearestRoads[0];
  } catch (error) {
    if (error?.code !== 27 && !/ns not found|no geo/i.test(error.message || '')) throw error;
  }

  if (!road) {
    return {
      roadIdentified: false,
      coordinates: point,
      message: 'No KGIS road was found within 5 km of the supplied coordinates.',
      verifiedRoadHistory: null,
      aiPrediction: null
    };
  }

  const match = await RoadMatch.findOne({ kgisRoadCentrelineId: road.kgisRoadCentrelineId }).lean();
  const history = match ? await RoadWorkHistory.findOne({ bbmpSegmentId: match.bbmpSegmentId }).sort({ workYear: -1 }).lean() : null;
  const priority = calculatePriority({ issueType, road, history });
  const aiPrediction = await predictContractor({ latitude: point.lat, longitude: point.lng, road, history });

  return {
    roadIdentified: true,
    coordinates: point,
    kgisRoad: {
      id: road.kgisRoadCentrelineId,
      distanceFromRoadMeters: Math.round(road.distanceFromRoadMeters),
      ward: road.kgisWardId || null,
      roadType: road.roadType || null,
      roadSurface: road.roadSurface || null,
      roadClass: road.roadClass || null
    },
    verifiedRoadHistory: match && history ? {
      bbmpSegmentId: match.bbmpSegmentId,
      streetName: match.streetName || history.streetName || null,
      ward: match.ward || history.ward || null,
      zone: match.zone || history.zone || null,
      matchConfidence: match.matchConfidence,
      matchMethod: match.matchMethod,
      contractor: history.contractorName ? {
        name: history.contractorName,
        registrationNo: history.contractorRegistrationNo || null,
        phone: history.contractorPhone || null
      } : null,
      workHistory: history
    } : null,
    message: match && history ? null : UNAVAILABLE_MESSAGE,
    aiPrediction: aiPrediction ? {
      predictedContractor: aiPrediction.predicted_contractor || null,
      confidence: aiPrediction.confidence ?? null,
      source: aiPrediction.source || 'experimental_model',
      warning: aiPrediction.warning || 'Supporting prediction only; verified road history is authoritative.'
    } : null,
    priority
  };
}

export { UNAVAILABLE_MESSAGE };