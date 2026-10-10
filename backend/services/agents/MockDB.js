// Mock Databases for Smart-Horizon Agents

export const AuthoritiesDB = [
  {
    authorityId: 'AUTH_NOIDA_ROAD',
    department: 'Noida Authority Road Works',
    jurisdiction: 'Gautam Buddha Nagar',
    issueTypes: ['POTHOLE', 'CRACK', 'ROAD_DAMAGE'],
    contact: 'roads@noidaauthorityonline.in',
    slaHours: 48
  },
  {
    authorityId: 'AUTH_NOIDA_DRAINAGE',
    department: 'Noida Authority Public Health & Drains',
    jurisdiction: 'Gautam Buddha Nagar',
    issueTypes: ['WATERLOGGING', 'DRAIN_BLOCK'],
    contact: 'drainage@noidaauthorityonline.in',
    slaHours: 24
  },
  {
    authorityId: 'AUTH_NOIDA_CIVIC',
    department: 'Noida Authority Encroachment & Civic',
    jurisdiction: 'Gautam Buddha Nagar',
    issueTypes: ['ENCROACHMENT', 'HAWKER', 'VENDOR'],
    contact: 'civic@noidaauthorityonline.in',
    slaHours: 72
  },
  {
    authorityId: 'AUTH_NOIDA_PARKS',
    department: 'Noida Authority Horticulture',
    jurisdiction: 'Gautam Buddha Nagar',
    issueTypes: ['TREE', 'FALLEN TREE', 'FALLEN_TREE'],
    contact: 'parks@noidaauthorityonline.in',
    slaHours: 24
  },
  {
    authorityId: 'AUTH_NTP_ENFORCEMENT',
    department: 'Noida Traffic Police',
    jurisdiction: 'Noida - NCR',
    issueTypes: ['SPEEDING', 'NO_HELMET', 'ILLEGAL_PARKING', 'RASH_DRIVING'],
    contact: 'enforcement@noidapolice.gov.in',
    slaHours: 12
  },
  {
    authorityId: 'AUTH_EMERGENCY_RESPONSE',
    department: 'Central Emergency Response (112)',
    jurisdiction: 'Uttar Pradesh',
    issueTypes: ['ACCIDENT', 'MEDICAL_EMERGENCY', 'FIRE'],
    contact: '112@uppolice.gov.in',
    slaHours: 1
  }
];

export const ContractorsDB = [
  {
    contractorId: 'CTR-1024',
    name: 'Noida Express Infra Projects Ltd',
    department: 'Noida Authority Road Works',
    zones: ['Sector 18', 'Noida Expressway', 'Mahamaya Flyover'],
    activeContracts: ['MAINT_2026_01'],
    slaHours: 24,
    contact: 'ops@noidaexpressinfra.in',
    performanceScore: 4.5
  },
  {
    contractorId: 'CTR-2099',
    name: 'Rapid NCR Repair Solutions',
    department: 'Noida Authority Road Works',
    zones: ['Sector 62', 'Botanical Garden', 'Okhla Border'],
    activeContracts: ['MAINT_2026_05'],
    slaHours: 36,
    contact: 'dispatch@rapidncr.in',
    performanceScore: 4.2
  },
  {
    contractorId: 'CTR-3188',
    name: 'Greater Noida Corridor Works',
    department: 'Noida Authority Road Works',
    zones: ['Advant Navis', 'Pari Chowk', 'Expressway Corridor'],
    activeContracts: ['MAINT_2026_09'],
    slaHours: 24,
    contact: 'ops@gncorridor.in',
    performanceScore: 4.6
  }
];

export const RoadGISDB = [
  {
    roadId: 'ROAD_NOIDA_EXPRESSWAY',
    name: 'Noida - Greater Noida Expressway',
    type: 'Expressway',
    speedLimit: 80,
    zone: 'Expressway Corridor',
    capacity: 'HIGH'
  },
  {
    roadId: 'ROAD_SEC18_COMMERCIAL',
    name: 'Sector 18 Commercial Ring',
    type: 'Commercial CBD',
    speedLimit: 40,
    zone: 'Sector 18',
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
    if (department !== 'Noida Authority Road Works') return null;
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
