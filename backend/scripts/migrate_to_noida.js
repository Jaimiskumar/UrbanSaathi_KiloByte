import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_management';

const NOIDA_LOCATIONS = [
  'Sector 18 Atta Market, Noida',
  'Amity University Sector 125, Noida',
  'Advant Navis Tech Hub (Sec 142), Noida',
  'Botanical Garden Metro Interchange, Noida',
  'Mahamaya Flyover Corridor, Noida',
  'Kalindi Kunj - Noida Border, Noida',
  'Sector 62 IT Park Avenue, Noida',
  'Pari Chowk Express Hub, Greater Noida'
];

const NOIDA_POLICE_STATIONS = [
  { name: 'Sector 20 Police Station, Noida', contact: '+91-120-252-2222', distance: '0.8 km' },
  { name: 'Sector 39 Police Station, Noida', contact: '+91-120-244-1111', distance: '1.1 km' },
  { name: 'Sector 126 Police Station (Amity Gate)', contact: '+91-120-247-3333', distance: '0.5 km' },
  { name: 'Noida Expressway Traffic Police', contact: '+91-120-255-4444', distance: '1.4 km' },
  { name: 'Sector 58 Police Station, Noida', contact: '+91-120-258-5555', distance: '1.2 km' }
];

function transformPlate(plate) {
  if (!plate || typeof plate !== 'string') return 'UP16AB1234';
  let clean = plate.trim().toUpperCase();
  
  // If formatted like KA-05-IQ-3225, RJ-20-UT-0865, TN-13-RV-7863, etc.
  if (clean.includes('-')) {
    return clean.replace(/^[A-Z]{2}-\d{2}/, 'UP-16');
  }
  
  // If formatted like KA01AB1234, RJ20UT0865, MH04LU7685
  return clean.replace(/^[A-Z]{2}\d{2}/, 'UP16');
}

function getRandomNoidaCoords() {
  // Center around Noida Expressway & Sector 18 (28.53 to 28.58, 77.31 to 77.38)
  const baseLat = 28.5449;
  const baseLng = 77.3331;
  return {
    lat: +(baseLat + (Math.random() - 0.5) * 0.05).toFixed(6),
    lng: +(baseLng + (Math.random() - 0.5) * 0.05).toFixed(6)
  };
}

async function migrate() {
  console.log(' Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log(' Starting Noida & UP-16 Data Migration...');

  // 1. Migrate Users
  const users = await db.collection('users').find({}).toArray();
  for (const user of users) {
    const updates = {};
    if (user.vehicleNumber) {
      updates.vehicleNumber = transformPlate(user.vehicleNumber);
    }
    if (user.city && (user.city.includes('Bengaluru') || user.city.includes('Bangalore') || user.city.includes('Ahmedabad'))) {
      updates.city = 'Noida';
    }
    if (user.address && (user.address.includes('Bengaluru') || user.address.includes('Bangalore') || user.address.includes('Karnataka') || user.address.includes('Gujarat'))) {
      updates.address = 'Sector 125, Noida, Uttar Pradesh';
    }
    if (Object.keys(updates).length > 0) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
    }
  }
  console.log(` Updated ${users.length} users.`);

  // 2. Migrate Challans
  const challans = await db.collection('challans').find({}).toArray();
  let challanCount = 0;
  for (const c of challans) {
    const updates = {};
    if (c.vehicleNumber) {
      updates.vehicleNumber = transformPlate(c.vehicleNumber);
    }
    // Location check
    updates.violationLocation = NOIDA_LOCATIONS[challanCount % NOIDA_LOCATIONS.length];
    const coords = getRandomNoidaCoords();
    updates.latitude = coords.lat;
    updates.longitude = coords.lng;

    if (c.description) {
      updates.description = c.description
        .replace(/Silk Board Junction, Bengaluru/gi, 'Sector 18 Atta Market, Noida')
        .replace(/Silk Board Junction/gi, 'Sector 18 Atta Market, Noida')
        .replace(/Bengaluru/gi, 'Noida')
        .replace(/Bangalore/gi, 'Noida')
        .replace(/Upload Processing Station/gi, 'Amity University Corridor, Noida')
        .replace(/Test Location/gi, 'Sector 18 Atta Market, Noida');
    }

    await db.collection('challans').updateOne({ _id: c._id }, { $set: updates });
    challanCount++;
  }
  console.log(` Updated ${challanCount} challans.`);

  // 3. Migrate Fines
  const fines = await db.collection('fines').find({}).toArray();
  let fineCount = 0;
  for (const f of fines) {
    const updates = {};
    if (f.vehicleNumber) {
      updates.vehicleNumber = transformPlate(f.vehicleNumber);
    }
    const locName = NOIDA_LOCATIONS[fineCount % NOIDA_LOCATIONS.length];
    if (f.location) {
      updates.location = { ...f.location, name: locName };
    } else {
      updates.location = { name: locName };
    }
    if (f.violationLocation) {
      updates.violationLocation = locName;
    }
    if (f.description) {
      updates.description = f.description
        .replace(/Silk Board Junction, Bengaluru/gi, 'Sector 18 Atta Market, Noida')
        .replace(/Silk Board/gi, 'Sector 18 Atta Market, Noida')
        .replace(/Bengaluru/gi, 'Noida')
        .replace(/Bangalore/gi, 'Noida')
        .replace(/Koramangala/gi, 'Sector 18 Atta Market, Noida');
    }
    await db.collection('fines').updateOne({ _id: f._id }, { $set: updates });
    fineCount++;
  }
  console.log(` Updated ${fineCount} fines.`);

  // 4. Migrate Illegal Parking
  const illegalParkings = await db.collection('illegalparkings').find({}).toArray();
  let parkingCount = 0;
  for (const p of illegalParkings) {
    const updates = {};
    if (p.licensePlate) {
      updates.licensePlate = transformPlate(p.licensePlate);
    }
    const locName = NOIDA_LOCATIONS[parkingCount % NOIDA_LOCATIONS.length];
    updates.location = locName;
    const auth = NOIDA_POLICE_STATIONS[parkingCount % NOIDA_POLICE_STATIONS.length];
    updates.authority = auth;
    updates.coordinates = getRandomNoidaCoords();

    if (p.alertDetails && p.alertDetails.recipient) {
      updates['alertDetails.recipient'] = auth.name;
    }

    await db.collection('illegalparkings').updateOne({ _id: p._id }, { $set: updates });
    parkingCount++;
  }
  console.log(` Updated ${parkingCount} illegal parkings.`);

  // 5. Migrate Traffic Violations
  const violations = await db.collection('trafficviolations').find({}).toArray();
  let vioCount = 0;
  for (const v of violations) {
    const updates = {};
    if (v.vehicleNumber) {
      updates.vehicleNumber = transformPlate(v.vehicleNumber);
    }
    updates.signalLocation = NOIDA_LOCATIONS[vioCount % NOIDA_LOCATIONS.length];
    const coords = getRandomNoidaCoords();
    updates.latitude = coords.lat;
    updates.longitude = coords.lng;

    await db.collection('trafficviolations').updateOne({ _id: v._id }, { $set: updates });
    vioCount++;
  }
  console.log(` Updated ${vioCount} traffic violations.`);

  // 6. Migrate Helmet Violations
  const helmets = await db.collection('helmetviolations').find({}).toArray();
  let helmetCount = 0;
  for (const h of helmets) {
    const updates = {};
    if (h.vehicleNumber) {
      updates.vehicleNumber = transformPlate(h.vehicleNumber);
    }
    updates.location = NOIDA_LOCATIONS[helmetCount % NOIDA_LOCATIONS.length];
    const coords = getRandomNoidaCoords();
    updates.latitude = coords.lat;
    updates.longitude = coords.lng;

    await db.collection('helmetviolations').updateOne({ _id: h._id }, { $set: updates });
    helmetCount++;
  }
  console.log(` Updated ${helmetCount} helmet violations.`);

  // 7. Migrate Encroachments
  const encroachments = await db.collection('encroachments').find({}).toArray();
  let encCount = 0;
  for (const e of encroachments) {
    const updates = {};
    if (e.licensePlate) {
      updates.licensePlate = transformPlate(e.licensePlate);
    }
    updates.location = NOIDA_LOCATIONS[encCount % NOIDA_LOCATIONS.length];
    updates.coordinates = getRandomNoidaCoords();

    await db.collection('encroachments').updateOne({ _id: e._id }, { $set: updates });
    encCount++;
  }
  console.log(` Updated ${encCount} encroachments.`);

  // 8. Migrate Street Encroachments
  const streetEnc = await db.collection('streetencroachments').find({}).toArray();
  let sEncCount = 0;
  for (const se of streetEnc) {
    const updates = {};
    updates.location = NOIDA_LOCATIONS[sEncCount % NOIDA_LOCATIONS.length];
    updates.coordinates = getRandomNoidaCoords();

    await db.collection('streetencroachments').updateOne({ _id: se._id }, { $set: updates });
    sEncCount++;
  }
  console.log(` Updated ${sEncCount} street encroachments.`);

  // 9. Migrate Road Issues
  const roadIssues = await db.collection('roadissues').find({}).toArray();
  let issueCount = 0;
  for (const r of roadIssues) {
    const updates = {};
    updates.location = NOIDA_LOCATIONS[issueCount % NOIDA_LOCATIONS.length];
    updates.coordinates = getRandomNoidaCoords();

    await db.collection('roadissues').updateOne({ _id: r._id }, { $set: updates });
    issueCount++;
  }
  console.log(` Updated ${issueCount} road issues.`);

  // 10. Migrate Emergencies
  const emergencies = await db.collection('emergencies').find({}).toArray();
  let emCount = 0;
  for (const em of emergencies) {
    const updates = {};
    updates.destination = 'Jaypee Hospital Sector 128, Noida';
    updates.startIntersection = 'Amity University Gate 2 Chowk';
    if (em.route && Array.isArray(em.route)) {
      updates.route = em.route.map((r, i) => ({
        ...r,
        name: NOIDA_LOCATIONS[i % NOIDA_LOCATIONS.length],
        lat: 28.5449 + i * 0.01,
        lng: 77.3331 + i * 0.01
      }));
    }
    await db.collection('emergencies').updateOne({ _id: em._id }, { $set: updates });
    emCount++;
  }
  console.log(` Updated ${emCount} emergencies.`);

  console.log(' MIGRATION COMPLETED SUCCESSFULLY!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
