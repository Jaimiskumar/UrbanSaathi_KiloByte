import { getSocketServer } from './socketServer.js';

// In-memory route advisory store initialized with Noida / Amity University NCR corridor alerts
const routeAlertStore = [
  {
    _id: 'adv-amity-01',
    route: 'Sector 125 Expressway Service Road (Amity Gate 2)',
    congestionLevel: 'HIGH',
    reason: 'Heavy peak-hour student pedestrian movement and pickup congestion near Amity Gate 2.',
    alternatePath: 'Divert through Sector 126 loop or take the Kalindi Kunj parallel arterial road.',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    source: 'traffic_management'
  },
  {
    _id: 'adv-mahamaya-02',
    route: 'Mahamaya Flyover Expressway Junction',
    congestionLevel: 'MODERATE',
    reason: 'Lane reduction due to road maintenance near Botanical Garden ramp.',
    alternatePath: 'Use Sector 44 inner road to merge directly toward Sector 18.',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    source: 'traffic_management'
  }
];

export function getActiveAdvisories() {
  const now = Date.now();
  return routeAlertStore.filter((alert) => new Date(alert.expiresAt).getTime() > now);
}

export function addAdvisory(advisoryData) {
  const advisory = {
    _id: advisoryData._id || `route-${Date.now()}`,
    route: advisoryData.route || 'Noida Smart City Corridor',
    congestionLevel: advisoryData.congestionLevel || 'HIGH',
    reason: advisoryData.reason || 'High traffic volume reported.',
    alternatePath: advisoryData.alternatePath || 'Use parallel arterial corridor',
    createdAt: advisoryData.createdAt || new Date().toISOString(),
    expiresAt: advisoryData.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    source: advisoryData.source || 'system'
  };

  routeAlertStore.unshift(advisory);

  try {
    const io = getSocketServer();
    if (io && typeof io.emit === 'function') {
      io.emit('traffic_advisory_created', advisory);
    }
  } catch (err) {
    console.error('Failed to emit advisory socket event:', err.message);
  }

  return advisory;
}
