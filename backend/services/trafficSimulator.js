import TrafficSignal from '../models/TrafficSignal.js';
import ParkingSpot from '../models/ParkingSpot.js';
import ParkingZone from '../models/ParkingZone.js';

const INTERSECTIONS = [
  { signalId: 'SIG001', name: 'Silk Board Central Junction',        lat: 12.9176, lng: 77.6238 },
  { signalId: 'SIG002', name: 'Smart Horizon College Campus Hub',    lat: 12.9279, lng: 77.6271 },
  { signalId: 'SIG003', name: 'Koramangala 5th Block Junction',      lat: 12.9352, lng: 77.6245 },
  { signalId: 'SIG004', name: 'Madiwala Crosswalk',                  lat: 12.9226, lng: 77.6174 },
  { signalId: 'SIG005', name: 'Electronic City Tollgate Corridor',   lat: 12.8452, lng: 77.6602 },
  { signalId: 'SIG006', name: 'Indiranagar 100ft Road Signal',       lat: 12.9784, lng: 77.6408 }
];

const PARKING_ZONES = [
  { zoneId: 'ZONE-1', zone: 'Smart Horizon College Campus Hub', count: 30, pricePerHour: 50, lat: 12.9279, lng: 77.6271 },
  { zoneId: 'ZONE-2', zone: 'Silk Board Multi-Level Plaza',      count: 40, pricePerHour: 60, lat: 12.9176, lng: 77.6238 },
  { zoneId: 'ZONE-3', zone: 'Koramangala 5th Block Parking',    count: 35, pricePerHour: 70, lat: 12.9352, lng: 77.6245 },
  { zoneId: 'ZONE-4', zone: 'Electronic City Toll Plaza',        count: 50, pricePerHour: 40, lat: 12.8452, lng: 77.6602 },
  { zoneId: 'ZONE-5', zone: 'Indiranagar 100ft Road Hub',        count: 30, pricePerHour: 80, lat: 12.9784, lng: 77.6408 },
  { zoneId: 'ZONE-6', zone: 'Madiwala Metro Station Parking',    count: 45, pricePerHour: 40, lat: 12.9226, lng: 77.6174 },
  { zoneId: 'ZONE-7', zone: 'Whitefield ITPL Tech Hub',          count: 60, pricePerHour: 50, lat: 12.9863, lng: 77.7308 },
  { zoneId: 'ZONE-8', zone: 'Hebbal Flyover Transit Hub',        count: 35, pricePerHour: 50, lat: 13.0358, lng: 77.5970 }
];

export async function initializeTrafficSimulation(io) {
  // ── Cleanup all old legacy zones and spots so only Bengaluru hubs exist ──
  const validZoneIds = PARKING_ZONES.map(z => z.zoneId);
  const validZoneNames = PARKING_ZONES.map(z => z.zone);
  await ParkingZone.deleteMany({ name: { $nin: validZoneNames } });
  await ParkingSpot.deleteMany({ zone: { $nin: validZoneNames } });
  console.log('🧹 Cleaned up ALL legacy non-Bengaluru parking data');

  // ── Initialize traffic signals ──────────────────────────────────────────────
  for (const intersection of INTERSECTIONS) {
    const exists = await TrafficSignal.findOne({ signalId: intersection.signalId });
    if (!exists) {
      await TrafficSignal.create({
        signalId: intersection.signalId,
        name: intersection.name,
        location: {
          name: intersection.name,
          lat: intersection.lat,
          lng: intersection.lng
        },
        status: 'green',
        currentTimer: 30,
        timings: { green: 30, yellow: 5, red: 30 },
        vehicleCount: Math.floor(Math.random() * 50),
        congestionLevel: 'low',
        connectedSignals: INTERSECTIONS
          .filter(i => i.signalId !== intersection.signalId)
          .slice(0, 2)
          .map(i => i.signalId),
        mode: 'auto',
        isActive: true,
        lastUpdated: new Date()
      });
    }
  }

  // ── Initialize parking zones & spots ────────────────────────────────────────
  for (const zoneData of PARKING_ZONES) {
    // Create zone if it doesn't exist
    const zoneExists = await ParkingZone.findOne({ zoneId: zoneData.zoneId });
    if (!zoneExists) {
      await ParkingZone.create({
        zoneId: zoneData.zoneId,
        name: zoneData.zone,
        location: {
          name: zoneData.zone,
          lat: zoneData.lat,
          lng: zoneData.lng
        },
        totalSpots: zoneData.count,
        pricePerHour: zoneData.pricePerHour,
        currency: 'INR',
        isActive: true,
        stats: {
          available: zoneData.count,
          occupied: 0,
          reserved: 0,
          revenue: 0
        }
      });
    }

    // Create spots for the zone
    for (let i = 1; i <= zoneData.count; i++) {
      const spotId = `${zoneData.zoneId}-${String(i).padStart(3, '0')}`;
      const exists = await ParkingSpot.findOne({ spotId });
      if (!exists) {
        let type = 'regular';
        if (i <= 2) type = 'disabled';
        else if (i === 3) type = 'ev';

        await ParkingSpot.create({
          spotId,
          zoneId: zoneData.zoneId,
          zone: zoneData.zone,
          location: {
            name: `${zoneData.zone} Parking`,
            lat: zoneData.lat + (Math.random() - 0.5) * 0.002,
            lng: zoneData.lng + (Math.random() - 0.5) * 0.002
          },
          status: Math.random() > 0.3 ? 'available' : 'occupied',
          type,
          vehicleCategory: i <= (zoneData.count * 0.4) ? '2-wheeler' : '4-wheeler',
          floor: Math.floor(i / 20),
          pricePerHour: i <= (zoneData.count * 0.4) ? Math.floor(zoneData.pricePerHour * 0.5) : zoneData.pricePerHour,
          currency: 'INR',
          isActive: true
        });
      }
    }
  }

  // Ensure pricing is consistent across all spots
  await ParkingSpot.updateMany(
    { pricePerHour: { $exists: false } },
    { $set: { pricePerHour: 20, currency: 'INR' } }
  );

  // ── Start traffic simulation loop ────────────────────────────────────────────
  setInterval(async () => {
    try {
      const signals = await TrafficSignal.find({ mode: 'auto', isActive: true });

      for (const signal of signals) {
        const vehicleCount = Math.floor(Math.random() * 100);
        let congestionLevel = 'low';
        let timer = signal.timings?.green || 30;

        if (vehicleCount > 80) {
          congestionLevel = 'critical';
          timer = 90;
        } else if (vehicleCount > 60) {
          congestionLevel = 'high';
          timer = 60;
        } else if (vehicleCount > 35) {
          congestionLevel = 'medium';
          timer = 45;
        }

        const statuses = ['green', 'yellow', 'red'];
        const currentIndex = statuses.indexOf(signal.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        signal.vehicleCount = vehicleCount;
        signal.congestionLevel = congestionLevel;
        signal.currentTimer = timer;
        signal.status = nextStatus;
        signal.lastUpdated = new Date();

        await signal.save();
      }

      io.emit('traffic-update', signals);
    } catch (err) {
      // Silently handle simulation errors — don't crash the server
      console.error('Traffic simulation error:', err.message);
    }
  }, 5000);

  console.log('✅ Traffic simulation initialized with 8 parking zones and 6 signals');
}
