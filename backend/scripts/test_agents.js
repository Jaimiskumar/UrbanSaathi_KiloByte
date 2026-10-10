import { eventBus } from '../services/agents/index.js';

async function runTests() {
  console.log("=== STARTING SMART-HORIZON AGENT TESTS ===\n");

  // TEST 1: POTHOLE FLOW
  console.log("--- TEST 1: POTHOLE EVENT ---");
  const potholeEvent = {
    eventId: "EVT-TEST-POTHOLE-1",
    eventType: "POTHOLE_DETECTED",
    source: { type: "ML_MODEL", model: "pothole_v1" },
    location: { lat: 12.9716, lng: 77.5946 }, // CBD area
    detection: { class: "pothole", confidence: 0.94, severity: "HIGH" },
    evidence: { image: "evidence/pothole_123.jpg" },
    cameraId: "CAM_104"
  };

  eventBus.publish(potholeEvent);
  
  // Wait a bit for async processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  // TEST 2: ACCIDENT FLOW
  console.log("\n--- TEST 2: ACCIDENT EVENT ---");
  const accidentEvent = {
    eventId: "EVT-TEST-ACCIDENT-1",
    eventType: "ACCIDENT_DETECTED",
    source: { type: "ML_MODEL", model: "accident_v1" },
    location: { lat: 12.92, lng: 77.62, intersectionId: "JUNC_A" }, // Near ORR
    detection: { class: "accident", confidence: 0.98, severity: "CRITICAL", roadBlocked: true },
    evidence: { frames: ["frame_1.jpg", "frame_2.jpg"] },
    cameraId: "CAM_105"
  };

  eventBus.publish(accidentEvent);
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  // TEST 3: ENFORCEMENT -> E-CHALLAN FLOW
  console.log("\n--- TEST 3: ENFORCEMENT AND E-CHALLAN EVENT ---");
  eventBus.publish({
    eventId: "EVT-TEST-SPEED-1",
    eventType: "OVERSPEEDING",
    source: { type: "ML_MODEL", model: "speed_tracking" },
    location: { lat: 12.9716, lng: 77.5946 },
    detection: { speed: 82, licensePlate: "KA01AB1234", confidence: 0.91 },
    evidence: { frames: ["frame_1.jpg", "frame_2.jpg"] },
    cameraId: "CAM_106"
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // TEST 4: CIVIC WORK ORDER AND VERIFICATION FLOW
  console.log("\n--- TEST 4: WATERLOGGING EVENT ---");
  eventBus.publish({
    eventId: "EVT-TEST-WATER-1",
    eventType: "WATERLOGGING_DETECTED",
    source: { type: "ML_MODEL", model: "water_segmentation" },
    location: { lat: 12.9716, lng: 77.5946 },
    detection: { class: "waterlogging", confidence: 0.87, severity: "HIGH", roadBlocked: true },
    evidence: { image: "evidence/waterlogging_123.jpg" },
    cameraId: "CAM_107"
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("\n=== TESTS COMPLETED ===");
}

runTests();
