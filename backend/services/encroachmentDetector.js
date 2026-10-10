// Encroachment Detection Service
// Simulates AI-based detection of unauthorized hawkers, vendors, and obstructions

class EncroachmentDetector {
  constructor() {
    this.detectionThreshold = 300; // 5 minutes in seconds
    this.warningPeriod = 300; // 5 minutes warning before alert
  }

  // Simulate AI camera detection
  simulateDetection(cameraId, location, zone) {
    const objectTypes = ['vendor', 'cart', 'vehicle', 'obstacle', 'hawker'];
    const detectedObject = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    
    const severityMap = {
      'road-lane': 'high',
      'footpath': 'medium',
      'no-parking': 'medium',
      'restricted-area': 'high'
    };

    return {
      cameraId,
      location,
      zone,
      detectedObject,
      licensePlate: detectedObject === 'vehicle' ? this.generateLicensePlate() : null,
      imageUrl: `/api/camera-feed/${cameraId}/snapshot`,
      detectionTime: new Date(),
      status: 'detected',
      stationaryDuration: 0,
      coordinates: this.generateCoordinates(location),
      severity: severityMap[zone] || 'low',
      notes: `${detectedObject} detected in ${zone}`
    };
  }

  generateLicensePlate() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const series = `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}`;
    const number = String(Math.floor(1000 + Math.random() * 9000));
    return `UP-16-${series}-${number}`;
  }

  generateCoordinates(location) {
    // Simulate coordinates based on location
    const baseCoords = {
      'Sector 18 Atta Market': { lat: 28.5678, lng: 77.3211 },
      'Amity University Sector 125': { lat: 28.5449, lng: 77.3331 },
      'Advant Navis Tech Hub': { lat: 28.5032, lng: 77.4116 },
      'Botanical Garden Metro': { lat: 28.5644, lng: 77.3342 },
      'Mahamaya Flyover Corridor': { lat: 28.5528, lng: 77.3235 }
    };

    const base = baseCoords[location] || { lat: 28.5678, lng: 77.3211 };
    return {
      lat: base.lat + (Math.random() - 0.5) * 0.01,
      lng: base.lng + (Math.random() - 0.5) * 0.01
    };
  }

  // Check if encroachment should trigger warning
  shouldIssueWarning(encroachment) {
    return encroachment.stationaryDuration >= this.warningPeriod && 
           encroachment.status === 'detected';
  }

  // Check if encroachment should trigger alert
  shouldSendAlert(encroachment) {
    return encroachment.stationaryDuration >= (this.warningPeriod + this.detectionThreshold) && 
           encroachment.status === 'warning-issued';
  }

  // Update encroachment status based on duration
  updateStatus(encroachment, currentTime) {
    const duration = Math.floor((currentTime - new Date(encroachment.detectionTime)) / 1000);
    encroachment.stationaryDuration = duration;

    if (this.shouldSendAlert(encroachment)) {
      encroachment.status = 'alert-sent';
      encroachment.alertSentAt = currentTime;
    } else if (this.shouldIssueWarning(encroachment)) {
      encroachment.status = 'warning-issued';
      encroachment.warningIssuedAt = currentTime;
    }

    return encroachment;
  }
}

module.exports = new EncroachmentDetector();
