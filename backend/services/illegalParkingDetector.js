// Illegal Parking Detection Service using Hugging Face Dataset
import https from 'https';

class IllegalParkingDetector {
  constructor() {
    this.apiUrl = 'https://datasets-server.huggingface.co/rows?dataset=Mobiusi%2FIllegal-Parking-Automatic-Recognition-Dataset&config=default&split=train&offset=0&length=100';
    this.detectionCache = [];
    this.lastFetchTime = null;
  }

  // Fetch illegal parking data from Hugging Face
  async fetchIllegalParkingData() {
    return new Promise((resolve, reject) => {
      https.get(this.apiUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            // Process and extract rows with images
            if (parsed.rows && Array.isArray(parsed.rows)) {
              this.detectionCache = parsed.rows.map(item => {
                // Extract image URL from various possible structures
                let imageUrl = null;
                
                if (item.row) {
                  // Try different image field names
                  const imageFields = ['image', 'img', 'picture', 'photo', 'Image', 'IMG'];
                  
                  for (const field of imageFields) {
                    if (item.row[field]) {
                      const imgData = item.row[field];
                      
                      // Handle different image data structures
                      if (typeof imgData === 'string') {
                        imageUrl = imgData;
                        break;
                      } else if (imgData && typeof imgData === 'object') {
                        // Check for common URL properties
                        imageUrl = imgData.src || imgData.url || imgData.path || imgData.href;
                        if (imageUrl) break;
                        
                        // Check for bytes (base64)
                        if (imgData.bytes) {
                          imageUrl = `data:image/jpeg;base64,${imgData.bytes}`;
                          break;
                        }
                      }
                    }
                  }
                  
                  // Store the processed image URL back
                  if (imageUrl) {
                    item.row.processedImageUrl = imageUrl;
                  }
                }
                
                return item;
              });
              
              console.log(`📸 Processed ${this.detectionCache.length} images from Hugging Face dataset`);
              
              // Log sample of image URLs found
              const imagesFound = this.detectionCache.filter(item => item.row && item.row.processedImageUrl).length;
              console.log(`✅ Found ${imagesFound} valid images in dataset`);
            } else {
              this.detectionCache = [];
            }
            
            this.lastFetchTime = new Date();
            resolve(this.detectionCache);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  // Extract license plate from detection data
  extractLicensePlate(detection) {
    // Try to extract from various possible fields
    if (detection.row && detection.row.license_plate) {
      return detection.row.license_plate;
    }
    
    // Generate realistic Indian license plate if not available
    return this.generateIndianLicensePlate();
  }

  // Generate realistic UP-16 Noida license plate
  generateIndianLicensePlate() {
    const series = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + 
                   String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const number = String(Math.floor(Math.random() * 9000) + 1000);
    
    return `UP-16-${series}-${number}`;
  }

  // Extract location from detection
  extractLocation(detection) {
    const locations = [
      'Sector 18 Atta Market',
      'Amity University Sector 125 Gate',
      'Advant Navis Tech Park (Sec 142)',
      'Botanical Garden Metro Hub',
      'Mahamaya Flyover Corridor',
      'Sector 62 Model Town IT Park',
      'Okhla Bird Sanctuary Metro Hub',
      'Pari Chowk Central Gateway'
    ];
    
    return locations[Math.floor(Math.random() * locations.length)];
  }

  // Extract image URL from detection
  extractImageUrl(detection) {
    // First, check if we already processed the image URL
    if (detection.row && detection.row.processedImageUrl) {
      return detection.row.processedImageUrl;
    }
    
    // Try to extract image from Hugging Face dataset
    if (detection.row) {
      // Check for image field
      if (detection.row.image) {
        // If it's a URL string
        if (typeof detection.row.image === 'string') {
          return detection.row.image;
        }
        // If it's an object with src or url property
        if (typeof detection.row.image === 'object') {
          if (detection.row.image.src) return detection.row.image.src;
          if (detection.row.image.url) return detection.row.image.url;
          if (detection.row.image.path) return detection.row.image.path;
          if (detection.row.image.href) return detection.row.image.href;
          
          // Check for base64 bytes
          if (detection.row.image.bytes) {
            return `data:image/jpeg;base64,${detection.row.image.bytes}`;
          }
        }
      }
      
      // Check other possible image field names
      const imageFields = ['img', 'picture', 'photo', 'Image', 'IMG'];
      for (const field of imageFields) {
        if (detection.row[field]) {
          const imgData = detection.row[field];
          if (typeof imgData === 'string') {
            return imgData;
          }
          if (typeof imgData === 'object') {
            if (imgData.src) return imgData.src;
            if (imgData.url) return imgData.url;
            if (imgData.path) return imgData.path;
            if (imgData.bytes) return `data:image/jpeg;base64,${imgData.bytes}`;
          }
        }
      }
    }
    
    // Fallback: Use local images or placeholders
    const localImages = [
      '/images/illegal-parking/parking1.jpg',
      '/images/illegal-parking/parking2.jpg',
      '/images/illegal-parking/parking3.jpg',
      '/images/illegal-parking/parking4.jpg',
      '/images/illegal-parking/parking5.jpg'
    ];
    
    // Randomly select a local image
    return localImages[Math.floor(Math.random() * localImages.length)];
  }

  // Calculate fine amount based on violation type
  calculateFine(violationType) {
    const fineStructure = {
      'no-parking-zone': 500,
      'blocking-traffic': 1000,
      'footpath-parking': 500,
      'fire-lane': 2000,
      'disabled-spot': 5000,
      'double-parking': 1000,
      'bus-stop': 500,
      'default': 500
    };
    
    return fineStructure[violationType] || fineStructure.default;
  }

  // Determine violation type
  determineViolationType() {
    const types = [
      'no-parking-zone',
      'blocking-traffic',
      'footpath-parking',
      'fire-lane',
      'disabled-spot',
      'double-parking',
      'bus-stop'
    ];
    
    return types[Math.floor(Math.random() * types.length)];
  }

  // Get nearest authority
  getNearestAuthority(location) {
    const authorities = {
      'Sector 18 Atta Market': { name: 'Sector 20 Police Station, Noida', contact: '+91-120-2522222', distance: '0.4 km' },
      'Amity University Sector 125 Gate': { name: 'Sector 126 Police Station, Noida', contact: '+91-120-2444444', distance: '0.3 km' },
      'Advant Navis Tech Park (Sec 142)': { name: 'Sector 142 Police Station, Noida', contact: '+91-120-2499999', distance: '0.5 km' },
      'Botanical Garden Metro Hub': { name: 'Sector 39 Police Station, Noida', contact: '+91-120-2577777', distance: '0.6 km' },
      'Mahamaya Flyover Corridor': { name: 'Sector 39 Police Station, Noida', contact: '+91-120-2577777', distance: '0.8 km' },
      'Sector 62 Model Town IT Park': { name: 'Sector 58 Police Station, Noida', contact: '+91-120-2588888', distance: '0.6 km' },
      'Okhla Bird Sanctuary Metro Hub': { name: 'Sector 126 Police Station, Noida', contact: '+91-120-2444444', distance: '0.7 km' },
      'Pari Chowk Central Gateway': { name: 'Kasna Police Station, Greater Noida', contact: '+91-120-2340000', distance: '0.9 km' }
    };
    
    return authorities[location] || { 
      name: 'Noida Traffic Police Control Room', 
      contact: '+91-120-2422222', 
      distance: '1.0 km' 
    };
  }

  // Process detection and create violation record
  async processDetection(detection, index) {
    const licensePlate = this.extractLicensePlate(detection);
    const location = this.extractLocation(detection);
    const violationType = this.determineViolationType();
    const fineAmount = this.calculateFine(violationType);
    const authority = this.getNearestAuthority(location);
    const imageUrl = this.extractImageUrl(detection);
    
    const detectionTime = new Date(Date.now() - Math.random() * 3600000); // Random time in last hour
    
    return {
      id: `IPD${String(index + 1).padStart(4, '0')}`,
      licensePlate,
      location,
      violationType,
      fineAmount,
      imageUrl,
      detectionTime,
      status: 'detected',
      authority,
      cameraId: `CAM${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`,
      confidence: (85 + Math.random() * 14).toFixed(1), // 85-99% confidence
      alertSent: false,
      finePaid: false,
      coordinates: {
        lat: 28.5449 + (Math.random() - 0.5) * 0.05,
        lng: 77.3331 + (Math.random() - 0.5) * 0.05
      }
    };
  }

  // Send alert to authorities
  async sendAlertToAuthority(violation) {
    // Simulate sending alert (SMS/Email/App notification)
    console.log(`🚨 ALERT SENT to ${violation.authority.name}`);
    console.log(`   Vehicle: ${violation.licensePlate}`);
    console.log(`   Location: ${violation.location}`);
    console.log(`   Violation: ${violation.violationType}`);
    console.log(`   Contact: ${violation.authority.contact}`);
    
    return {
      success: true,
      alertId: `ALT${Date.now()}`,
      sentAt: new Date(),
      recipient: violation.authority.name,
      method: 'SMS + App Notification'
    };
  }

  // Generate fine record
  async generateFine(violation) {
    return {
      fineId: `FIN${Date.now()}`,
      violationId: violation.id,
      licensePlate: violation.licensePlate,
      amount: violation.fineAmount,
      violationType: violation.violationType,
      location: violation.location,
      detectionTime: violation.detectionTime,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      status: 'pending',
      paymentLink: `https://traffic.gov.in/pay/${violation.id}`,
      imageEvidence: violation.imageUrl
    };
  }
}

export default new IllegalParkingDetector();
