// Mock Databases for Smart-Horizon Agents

export const AuthoritiesDB = [
  {
    authorityId: 'AUTH_BBMP_ROAD',
    department: 'BBMP Road Maintenance',
    jurisdiction: 'Bengaluru Urban',
    issueTypes: ['POTHOLE', 'CRACK', 'ROAD_DAMAGE'],
    contact: 'roads@bbmp.gov.in',
    slaHours: 48
  },
  {
    authorityId: 'AUTH_BBMP_DRAINAGE',
    department: 'BBMP Storm Water Drains',
    jurisdiction: 'Bengaluru Urban',
    issueTypes: ['WATERLOGGING', 'DRAIN_BLOCK'],
    contact: 'drainage@bbmp.gov.in',
    slaHours: 24
  },
  {
    authorityId: 'AUTH_BBMP_CIVIC',
    department: 'BBMP Encroachment & Civic',
    jurisdiction: 'Bengaluru Urban',
    issueTypes: ['ENCROACHMENT', 'HAWKER', 'VENDOR'],
    contact: 'civic@bbmp.gov.in',
    slaHours: 72
  },
  {
    authorityId: 'AUTH_BBMP_PARKS',
    department: 'BBMP Parks & Horticulture',
    jurisdiction: 'Bengaluru Urban',
    issueTypes: ['TREE', 'FALLEN TREE', 'FALLEN_TREE'],
    contact: 'parks@bbmp.gov.in',
    slaHours: 24
  },
  {
    authorityId: 'AUTH_BTP_ENFORCEMENT',
    department: 'Bengaluru Traffic Police',
    jurisdiction: 'Bengaluru City',
    issueTypes: ['SPEEDING', 'NO_HELMET', 'ILLEGAL_PARKING', 'RASH_DRIVING'],
    contact: 'enforcement@btp.gov.in',
    slaHours: 12
  },
  {
    authorityId: 'AUTH_EMERGENCY_RESPONSE',
    department: 'Central Emergency Response (112)',
    jurisdiction: 'Karnataka',
    issueTypes: ['ACCIDENT', 'MEDICAL_EMERGENCY', 'FIRE'],
    contact: '112@ksp.gov.in',
    slaHours: 1
  }
];

export const ContractorsDB = [
  {
    contractorId: 'CTR-1024',
    name: 'ABC Infrastructure Pvt Ltd',
    department: 'BBMP Road Maintenance',
    zones: ['South', 'East', 'Outer Ring Road'],
    activeContracts: ['MAINT_2026_01'],
    slaHours: 24,
    contact: 'ops@abcinfra.in',
    performanceScore: 4.2
  },
  {
    contractorId: 'CTR-2099',
    name: 'Rapid Repair Solutions',
    department: 'BBMP Road Maintenance',
    zones: ['West', 'North', 'CBD'],
    activeContracts: ['MAINT_2026_05'],
    slaHours: 36,
    contact: 'dispatch@rapidrepair.in',
    performanceScore: 3.8
  },
  {
    contractorId: 'CTR-3188',
    name: 'V.L. Muniraju & Infra Projects Ltd.',
    department: 'BBMP Road Maintenance',
    zones: ['South Bengaluru', 'Silk Board', 'HSR Layout', 'Outer Ring Road'],
    activeContracts: ['MAINT_2026_09'],
    slaHours: 24,
    contact: 'south-ops@vlmuniraju.in',
    performanceScore: 4.5
  },
  {
    contractorId: 'CTR-4271',
    name: 'K.R.D.L. Corridor Works',
    department: 'BBMP Road Maintenance',
    zones: ['East Bengaluru', 'Whitefield', 'Bellandur', 'Marathahalli'],
    activeContracts: ['MAINT_2026_12'],
    slaHours: 30,
    contact: 'east-ops@krdl.in',
    performanceScore: 4.1
  },
  {
    contractorId: 'CTR-5360',
    name: 'North Bengaluru Roadworks Cooperative',
    department: 'BBMP Road Maintenance',
    zones: ['North Bengaluru', 'Hebbal', 'Yelahanka', 'Mekhri Circle'],
    activeContracts: ['MAINT_2026_15'],
    slaHours: 36,
    contact: 'north-ops@nblroadworks.in',
    performanceScore: 4.0
  }
];

export const RoadGISDB = [
  {
    roadId: 'ROAD_ORR_SECTOR_4',
    name: 'Outer Ring Road',
    type: 'Arterial',
    speedLimit: 60,
    zone: 'Outer Ring Road',
    capacity: 'HIGH'
  },
  {
    roadId: 'ROAD_MG_ROAD_1',
    name: 'MG Road',
    type: 'CBD',
    speedLimit: 40,
    zone: 'CBD',
    capacity: 'MEDIUM'
  }
];

export class MockDBService {
  static getAuthorityForIssue(issueType) {
    const normalized = String(issueType || '')
      .trim()
      .toUpperCase()
      .replace(/[-\s]+/g, '_');
    const aliases = {
      FALLEN_TREE: 'TREE',
      WATER_LOGGING: 'WATERLOGGING',
      ROAD_BLOCK: 'ROAD_BLOCKAGE'
    };
    const canonical = aliases[normalized] || normalized;
    return AuthoritiesDB.find(a => a.issueTypes.some((type) => type === canonical || type === normalized)) || null;
  }

  static getContractorForZone(department, zone) {
    if (department !== 'BBMP Road Maintenance') return null;
    const normalizedZone = String(zone || '').trim().toLowerCase();
    const exactMatches = ContractorsDB.filter((contractor) => contractor.department === department
      && contractor.zones.some((candidate) => candidate.toLowerCase() === normalizedZone));
    if (exactMatches.length) return exactMatches.sort((a, b) => b.performanceScore - a.performanceScore)[0];
    const partialMatches = ContractorsDB.filter((contractor) => contractor.department === department
      && contractor.zones.some((candidate) => normalizedZone.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(normalizedZone)));
    return partialMatches.sort((a, b) => b.performanceScore - a.performanceScore)[0] || null;
  }

  static getRoadByLocation(lat, lng) {
    // For mock purposes, just return a random or specific road based on simple logic
    if (lng > 77.6) return RoadGISDB[0]; // ORR
    return RoadGISDB[1]; // MG Road
  }
}
