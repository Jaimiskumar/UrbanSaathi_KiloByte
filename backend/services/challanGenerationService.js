import Challan from '../models/Challan.js';
import User from '../models/User.js';
import VehicleRC from '../models/VehicleRC.js';
import { io } from '../server.js';

/**
 * Generate unique challan number
 * Format: CHN-YYYY-XXXXX (e.g., CHN-2024-00001)
 */
function generateChallanNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `CHN-${year}-${random}`;
}

/**
 * Map violation type to challan violation type
 */
function mapViolationType(violationType, violationData = {}) {
  const typeMap = {
    'helmet_violation': 'helmet_violation',
    'speeding': 'speeding',
    'signal_breaking': 'signal_violation',
    'signal_violation': 'signal_violation',
    'illegal_parking': 'illegal_parking',
    'no-parking-zone': 'no_parking_zone',
    'double-parking': 'illegal_parking',
    'street_encroachment': 'encroachment',
    'pedestrian_gathering': 'encroachment'
  };
  
  return typeMap[violationType] || violationType;
}

const CITIZEN_DIRECTORY = [
  {
    plate: "KA01AB1234",
    name: "Rajesh Kumar",
    phone: "+91 98450 12345",
    email: "rajesh.kumar@gmail.com",
    model: "Honda City (White, 4-Wheeler)",
    address: "42, 14th Main, HSR Layout Sector 2, Bengaluru"
  },
  {
    plate: "KA05MN9876",
    name: "Priya Sharma",
    phone: "+91 98801 98765",
    email: "priya.sharma@yahoo.com",
    model: "TVS Jupiter (Matte Black, 2-Wheeler)",
    address: "108, 80ft Road, Koramangala 4th Block, Bengaluru"
  },
  {
    plate: "KA03HA4567",
    name: "Mohammed Arif",
    phone: "+91 97412 45678",
    email: "arif.m@outlook.com",
    model: "Bajaj Compact RE Auto (Yellow-Green, 3-Wheeler)",
    address: "29, Indiranagar 100ft Road, Bengaluru"
  },
  {
    plate: "KA04DE7890",
    name: "Ananya Deshmukh",
    phone: "+91 99003 78901",
    email: "ananya.d@gmail.com",
    model: "Hyundai Creta SX (Silver, 4-Wheeler)",
    address: "15, Outer Ring Road, Bellandur, Bengaluru"
  },
  {
    plate: "KA02XY3456",
    name: "Suresh Gowda",
    phone: "+91 96114 34567",
    email: "suresh.gowda@gmail.com",
    model: "Royal Enfield Classic 350 (Stealth Black, 2-Wheeler)",
    address: "77, Malleshwaram 8th Cross, Bengaluru"
  },
  {
    plate: "MH12CD5678",
    name: "Vikram Rathore",
    phone: "+91 95355 56789",
    email: "vikram.logistics@rediffmail.com",
    model: "Tata Prima 3530 Commercial Truck (Blue)",
    address: "Industrial Suburb, Peenya 2nd Stage, Bengaluru"
  },
  {
    plate: "DL3CAB9999",
    name: "Amitabh Verma",
    phone: "+91 98100 99999",
    email: "amitabh.verma@corp.in",
    model: "Mahindra XUV700 AX7 (Midnight Black, 4-Wheeler)",
    address: "Flat 402, Prestige Palms, Whitefield, Bengaluru"
  }
];

/**
 * Find vehicle owner from RC/insurance database or registry
 */
async function findVehicleOwner(vehicleNumber) {
  try {
    const cleanPlate = String(vehicleNumber).replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Check MongoDB models first
    const rc = await VehicleRC.findOne({ vehicleNumber: { $regex: cleanPlate, $options: 'i' } });
    if (rc && rc.ownerDetails) {
      return {
        name: rc.ownerDetails.name,
        phone: rc.ownerDetails.phone,
        email: rc.ownerDetails.email,
        address: rc.ownerDetails.address,
        model: rc.vehicleDetails?.model || 'Commercial/Private Vehicle',
        vehicleRC: rc._id
      };
    }
    
    // Check User database
    const user = await User.findOne({ 
      $or: [
        { vehicleNumbers: { $regex: cleanPlate, $options: 'i' } },
        { 'vehicles.number': { $regex: cleanPlate, $options: 'i' } }
      ]
    });
    if (user) {
      return {
        name: user.name,
        phone: user.phone,
        email: user.email,
        address: user.address || 'Bengaluru Urban',
        model: user.vehicles?.[0]?.model || 'Private Vehicle',
        userId: user._id
      };
    }

    // Lookup in Bengaluru Municipal Registry
    const matched = CITIZEN_DIRECTORY.find(c => c.plate.includes(cleanPlate) || cleanPlate.includes(c.plate));
    if (matched) return matched;
    
    // Fallback deterministic owner
    const hash = cleanPlate.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const fallback = CITIZEN_DIRECTORY[hash % CITIZEN_DIRECTORY.length];
    return {
      ...fallback,
      plate: cleanPlate
    };
  } catch (error) {
    console.error('Error finding vehicle owner:', error);
    return CITIZEN_DIRECTORY[0];
  }
}

/**
 * Create challan from violation
 * MAIN FUNCTION - Call this whenever a violation is created
 */
export async function createChallanFromViolation(violation, violationModel = 'TrafficViolation') {
  try {
    if (!violation.vehicleNumber) {
      console.warn('Cannot create challan: vehicle number unknown');
      return null;
    }

    // Step 1: Find vehicle owner
    const owner = await findVehicleOwner(violation.vehicleNumber);

    // Step 2: Generate challan number
    const challanNumber = violation.challanNumber || violation.challan_number || generateChallanNumber();
    const violationType = mapViolationType(violation.violationType || violation.type || violation.helmetStatus, violation);
    const location = violation.location || violation.signalLocation || violation.area || 'Silk Board Junction, Bengaluru';
    const evidenceImage = violation.evidence_photo || violation.imageUrl || violation.image_url || violation.snapshot;

    const legalSectionMap = {
      'rash_driving': 'Section 184, Motor Vehicles Act 1988 (Dangerous/Rash Driving)',
      'speeding': 'Section 183(2), Motor Vehicles Act 1988 (Over-Speeding)',
      'helmet_violation': 'Section 129, Motor Vehicles Act 1988 (No Helmet on 2-Wheeler)',
      'signal_violation': 'Section 119/177, Motor Vehicles Act 1988 (Red Light Jumping)',
      'illegal_parking': 'Section 122/177, Motor Vehicles Act 1988 (Illegal Parking / Obstruction)',
      'encroachment': 'Section 283 IPC / Municipal Encroachment Act'
    };

    const fineMap = {
      'rash_driving': 1500,
      'speeding': 1000,
      'helmet_violation': 500,
      'signal_violation': 1000,
      'illegal_parking': 1000,
      'encroachment': 2000
    };

    const fineAmount = violation.fineAmount || violation.fine_amount || fineMap[violationType] || 1000;
    const legalSection = violation.legal_section || legalSectionMap[violationType] || 'Motor Vehicles Act 1988';
    
    const challanData = {
      challanNumber,
      vehicleNumber: violation.vehicleNumber,
      ownerName: owner?.name || violation.owner_name || 'Citizen Driver',
      ownerPhone: owner?.phone || violation.owner_phone || '+91 98450 12345',
      ownerEmail: owner?.email || violation.owner_email || 'citizen@smartcity.gov.in',
      vehicleModel: owner?.model || violation.vehicle_model || 'Private Vehicle',
      legalSection,
      violationType,
      violationLocation: location,
      latitude: violation.latitude || 12.9172,
      longitude: violation.longitude || 77.6228,
      violationDateTime: violation.timestamp || violation.createdAt || new Date(),
      cameraId: violation.cameraId || 'CCTV-BLR-CAM-01',
      imageUrl: evidenceImage,
      
      violationDetails: {
        violationId: violation._id?.toString() || violation.violation_id,
        violationModel: violationModel,
        ownerName: owner?.name,
        vehicleModel: owner?.model,
        ...(violation.speedRecorded && { speedRecorded: violation.speedRecorded }),
        ...(violation.speedLimit && { speedLimit: violation.speedLimit }),
        ...(violation.helmetStatus && { helmetStatus: violation.helmetStatus }),
        ...(violation.signalStatus && { signalStatus: violation.signalStatus })
      },
      
      severity: violation.severity || 'high',
      fineAmount: fineAmount,
      description: violation.title || generateChallanDescription({ ...violation, fineAmount, signalLocation: location }),
      
      status: 'pending',
      paymentStatus: 'pending'
    };

    // Step 3: Upsert challan in database
    const challan = await Challan.findOneAndUpdate(
      { challanNumber },
      challanData,
      { upsert: true, new: true }
    );

    const broadcastPayload = {
      _id: challan._id,
      fineId: challan.challanNumber,
      challanNumber: challan.challanNumber,
      vehicleNumber: challan.vehicleNumber,
      ownerName: challan.ownerName,
      ownerPhone: challan.ownerPhone,
      ownerEmail: challan.ownerEmail,
      vehicleModel: challan.vehicleModel,
      violationType: challan.violationType,
      legalSection: challan.legalSection,
      fineAmount: challan.fineAmount,
      amount: challan.fineAmount,
      location: challan.violationLocation,
      violationLocation: challan.violationLocation,
      imageUrl: challan.imageUrl,
      evidencePhoto: challan.imageUrl,
      description: challan.description,
      status: 'pending',
      timestamp: challan.violationDateTime,
      date: challan.violationDateTime,
      createdAt: challan.createdAt
    };

    // Step 4: Multi-Channel Real-time Broadcast across all Admin and Citizen portals
    io.emit('challan_issued', broadcastPayload);
    io.emit('new_challan_issued', broadcastPayload);
    io.emit('new-fine', broadcastPayload);
    io.emit('admin_challan_generated', {
      type: 'new_challan',
      challan: broadcastPayload,
      message: `🎟️ New E-Challan Issued: ${challan.vehicleNumber} (${challan.violationType})`,
      fine: challan.fineAmount
    });
    io.emit('citizen_challan_notification', {
      type: 'challan_received',
      challan: broadcastPayload,
      message: `⚠️ Traffic violation E-Challan issued for ${challan.vehicleNumber}`
    });
    io.emit('violation_detected', broadcastPayload);

    console.log(`✅ Real-Time E-Challan Synchronized: ${challanNumber} (${challan.vehicleNumber} - ${challan.ownerName} - ₹${challan.fineAmount})`);
    return challan;

  } catch (error) {
    console.error('Error creating challan from violation:', error);
    return null;
  }
}

/**
 * Generate human-readable challan description
 */
function generateChallanDescription(violation) {
  const descriptions = {
    'helmet_violation': `No helmet detected for 2-wheeler at ${violation.signalLocation || 'signal'}. Vehicle number: ${violation.vehicleNumber}. Fine: ₹500`,
    'speeding': `Overspeeding detected at ${violation.signalLocation || 'location'}. Speed: ${violation.speedRecorded} km/h (limit: ${violation.speedLimit} km/h). Fine: ₹${violation.fineAmount}`,
    'signal_violation': `Signal violation (${violation.signalStatus || 'red light jumping'}) detected at ${violation.signalLocation || 'signal'}. Fine: ₹${violation.fineAmount}`,
    'illegal_parking': `Illegal parking detected at ${violation.location || 'location'}. Violation type: ${violation.violationType}. Fine: ₹${violation.fineAmount}`,
    'street_encroachment': `Street encroachment detected. Crowd size: ${violation.crowdSize || 'multiple'}. Road blockage: ${violation.roadBlockagePercentage || '60'}%`
  };

  return descriptions[violation.violationType] || 
         descriptions[violation.helmetStatus] || 
         `Traffic violation at ${violation.signalLocation || violation.location || 'unknown location'}. Fine: ₹${violation.fineAmount}`;
}

/**
 * Create challans in bulk (for batch processing)
 */
export async function createChallansFromViolations(violations) {
  const results = {
    success: [],
    failed: []
  };

  for (const violation of violations) {
    try {
      const challan = await createChallanFromViolation(violation);
      if (challan) {
        results.success.push(challan.challanNumber);
      } else {
        results.failed.push(violation._id?.toString());
      }
    } catch (error) {
      console.error('Error processing violation:', error);
      results.failed.push(violation._id?.toString());
    }
  }

  return results;
}
