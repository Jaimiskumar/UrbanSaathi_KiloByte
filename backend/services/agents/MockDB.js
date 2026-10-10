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
    issueTypes: ['ENCROACHMENT', 'HAWKER', 'VENDOR', 'TREE'],
    contact: 'civic@bbmp.gov.in',
    slaHours: 72
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
    return AuthoritiesDB.find(a => a.issueTypes.includes(issueType)) || null;
  }

  static getContractorForZone(department, zone) {
    return ContractorsDB.find(c => c.department === department && c.zones.includes(zone)) || null;
  }

  static getRoadByLocation(lat, lng) {
    // For mock purposes, just return a random or specific road based on simple logic
    if (lng > 77.6) return RoadGISDB[0]; // ORR
    return RoadGISDB[1]; // MG Road
  }
}
