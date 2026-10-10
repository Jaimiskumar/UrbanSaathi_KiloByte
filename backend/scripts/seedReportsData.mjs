import mongoose from 'mongoose';
import Fine from '../models/Fine.js';
import User from '../models/User.js';
import IllegalParking from '../models/IllegalParking.js';
import ParkingBooking from '../models/ParkingBooking.js';
import RoadIssue from '../models/RoadIssue.js';

const MONGODB_URI = 'mongodb://localhost:27017/traffic_management';

async function seedReportsData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const citizen = await User.findOne({ role: 'citizen' });
    if (!citizen) {
      console.error('No citizen user found!');
      return;
    }

    console.log(`Seeding reports data for citizen: ${citizen.name}`);

    // 1. Clear existing for fresh start (optional, but good for demo)
    // await Fine.deleteMany({});
    // await ParkingBooking.deleteMany({});
    // await IllegalParking.deleteMany({});
    // await RoadIssue.deleteMany({});

    // 2. Parking Bookings (Multiple days to show in daily reports)
    const bookings = [];
    const zones = ['Oasis Mall', 'Virat Mall', 'Park Complex'];
    for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i % 5)); // Spread over last 5 days
        bookings.push({
            bookingId: `BK-${Date.now()}-${i}`,
            spotId: `SPOT-${100 + i}`,
            zoneId: `ZONE-0${(i % 3) + 1}`,
            zone: zones[i % 3],
            userId: citizen._id,
            vehicleNumber: citizen.vehicleNumber || 'KA-01-BN-4452',
            startTime: date,
            endTime: new Date(date.getTime() + 3600000 * 2),
            createdAt: date,
            durationHours: 2,
            pricePerHour: 20,
            totalAmount: 40,
            status: 'completed',
            paymentStatus: 'paid'
        });
    }
    await ParkingBooking.insertMany(bookings);
    console.log('Parking Bookings seeded');

    // 3. Road Issues
    const issues = [
        {
            userId: citizen._id,
            issueType: 'Pothole',
            locationName: 'Silk Board Central Junction',
            coordinates: { lat: 12.9176, lng: 77.6238 },
            description: 'Major pothole near the highway entrance.',
            imageUrl: 'https://via.placeholder.com/400x300/334155/ffffff?text=Pothole',
            status: 'Reported'
        },
        {
            userId: citizen._id,
            issueType: 'Water Logging',
            locationName: 'Smart Horizon College Campus Road',
            coordinates: { lat: 12.9279, lng: 77.6271 },
            description: 'Heavy water logging after rain.',
            imageUrl: 'https://via.placeholder.com/400x300/334155/ffffff?text=Water+Logging',
            status: 'In Progress'
        },
        {
            userId: citizen._id,
            issueType: 'Roadblock',
            locationName: 'Koramangala 5th Block Stretch',
            coordinates: { lat: 12.9352, lng: 77.6245 },
            description: 'Temporary roadblock due to infrastructure maintenance.',
            imageUrl: 'https://via.placeholder.com/400x300/334155/ffffff?text=Roadblock',
            status: 'Resolved',
            resolvedAt: new Date()
        }
    ];
    await RoadIssue.insertMany(issues);
    console.log('Road Issues seeded');

    // 4. More Fines (Diverse types for report segments)
    const extraFines = [
        {
            fineId: `FINE-SCH-${Date.now()}-1`,
            userId: citizen._id,
            vehicleNumber: 'KA-05-PQ-8899',
            violationType: 'no_helmet',
            amount: 500,
            location: { name: 'Madiwala Crosswalk' },
            status: 'pending',
            issuedAt: new Date()
        },
        {
            fineId: `FINE-SCH-${Date.now()}-2`,
            userId: citizen._id,
            vehicleNumber: 'KA-01-AB-1234',
            violationType: 'signal_violation',
            amount: 1000,
            location: { name: 'Silk Board Central' },
            status: 'paid',
            issuedAt: new Date(Date.now() - 86400000)
        }
    ];
    await Fine.insertMany(extraFines);
    console.log('Extra Fines seeded');

  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    mongoose.connection.close();
  }
}

seedReportsData();
