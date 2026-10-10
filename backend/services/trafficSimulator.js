import TrafficSignal from '../models/TrafficSignal.js';
import ParkingSpot from '../models/ParkingSpot.js';
import ParkingZone from '../models/ParkingZone.js';

const INTERSECTIONS = [
  { signalId: 'SIG001', name: 'Amity University Gate 2 Chowk',          lat: 28.5449, lng: 77.3331 },
  { signalId: 'SIG002', name: 'Mahamaya Flyover Expressway Junction',    lat: 28.5528, lng: 77.3235 },
  { signalId: 'SIG003', name: 'Sector 18 Atta Market Central Signal',    lat: 28.5678, lng: 77.3211 },
  { signalId: 'SIG004', name: 'Botanical Garden Metro Interchange',      lat: 28.5644, lng: 77.3342 },
  { signalId: 'SIG005', name: 'Advant Navis Sector 142 Plaza',          lat: 28.5032, lng: 77.4116 },
  { signalId: 'SIG006', name: 'Kalindi Kunj Border Signal',              lat: 28.5458, lng: 77.3115 }
];

const PARKING_ZONES = [
  { zoneId: 'ZONE-1', zone: 'Amity University Sector 125 Campus Parking', count: 45, pricePerHour: 30, lat: 28.5449, lng: 77.3331 },
  { zoneId: 'ZONE-2', zone: 'Mahamaya Flyover Transit Parking Hub',       count: 40, pricePerHour: 40, lat: 28.5528, lng: 77.3235 },
  { zoneId: 'ZONE-3', zone: 'Sector 18 Atta Market Multi-Level Plaza',    count: 60, pricePerHour: 50, lat: 28.5678, lng: 77.3211 },
  { zoneId: 'ZONE-4', zone: 'Botanical Garden Metro Park & Ride',         count: 50, pricePerHour: 30, lat: 28.5644, lng: 77.3342 },
  { zoneId: 'ZONE-5', zone: 'Advant Navis Tech Hub Parking (Sec 142)',    count: 40, pricePerHour: 40, lat: 28.5032, lng: 77.4116 },
  { zoneId: 'ZONE-6', zone: 'Okhla Bird Sanctuary Metro Parking',         count: 35, pricePerHour: 30, lat: 28.5444, lng: 77.3189 },
  { zoneId: 'ZONE-7', zone: 'Sector 62 IT Park Commercial Lot',           count: 50, pricePerHour: 35, lat: 28.6271, lng: 77.3653 },
  { zoneId: 'ZONE-8', zone: 'Pari Chowk Greater Noida Complex',           count: 35, pricePerHour: 30, lat: 28.4674, lng: 77.5141 }
];

export async function initializeTrafficSimulation(io) {
  // ── Cleanup all old legacy zones and spots so only Noida / Amity hubs exist ──
  const validZoneIds = PARKING_ZONES.map(z => z.zoneId);
  const validZoneNames = PARKING_ZONES.map(z => z.zone);
  await ParkingZone.deleteMany({ name: { $nin: validZoneNames } });
  await ParkingSpot.deleteMany({ zone: { $nin: validZoneNames } });
  await TrafficSignal.deleteMany({});
  console.log('🧹 Cleaned up ALL legacy parking and signal data for Noida - NCR grid');

  // ── Initialize traffic signals ──────────────────────────────────────────────
  for (const intersection of INTERSECTIONS) {
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
