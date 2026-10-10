/**
 * Centralized Noida & NCR Geospatial Intelligence Configuration & Data Structure
 * Centered on Amity University (Sector 125, Noida, Uttar Pradesh) and Noida-Greater Noida Expressway.
 */

export const BANGALORE_ZONES = [
  {
    zone_id: 'NOIDA-AMITY-01',
    name: 'Amity University Sector 125 Main Gate',
    latitude: 28.5449,
    longitude: 77.3331,
    road: 'Noida-Greater Noida Expressway / Sector 125 Service Lane',
    current_vehicle_density: 1820,
    average_speed: 12.5,
    road_condition: 'University Student Crosswalk & Peak Hour Pickup Rush',
    congestion_level: 'DARK_RED',
    risk_level: 'CRITICAL',
    noise_level: 91.5,
    incident_count: 2,
    prediction_5min: { queue_m: 1350, speed: 11.0, trend: 'INCREASING' },
    prediction_10min: { queue_m: 1600, speed: 9.8, trend: 'CRITICAL' },
    prediction_15min: { queue_m: 1850, speed: 8.5, trend: 'CRITICAL' },
    prediction_30min: { queue_m: 2200, speed: 7.0, trend: 'GRIDLOCK' },
    last_updated: new Date().toISOString(),
    incidents: [
      { id: 'INC-NOI-01', type: 'road_blockage', title: 'Cab Congestion outside Amity Gate 2', severity: 'HIGH', delay_impact_min: 18 },
      { id: 'INC-NOI-02', type: 'pothole', title: 'Service Road Pothole Cluster near Amity Overbridge', severity: 'HIGH', delay_impact_min: 12 }
    ],
    infrastructure_issue: {
      has_issue: true,
      type: 'pothole',
      severity: 'HIGH',
      capacity_reduction_percent: 35,
      work_order_id: 'WO-NOIDA-8812',
      crew: 'Noida Authority Rapid Patch Unit 03',
      eta_minutes: 7
    },
    noise_hotspot: {
      is_hotspot: true,
      noise_db: 91.5,
      classification: 'traffic_horn',
      exposure_risk: 'HIGH'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'Amity University Sector 125 Signal',
      status: 'Red',
      timer: 75,
      mode: 'adaptive'
    },
    recommendation: {
      action: 'Divert Kalindi Kunj bound flow via Sector 126 loop & increase Green Phase by 40s',
      expected_delay_reduction_percent: 42,
      confidence: 0.95,
      primary_cause: 'Amity Campus Peak Volume + Expressway Funnel'
    }
  },
  {
    zone_id: 'NOIDA-MAHAMAYA-02',
    name: 'Mahamaya Flyover Expressway Interchange',
    latitude: 28.5528,
    longitude: 77.3235,
    road: 'Noida-Greater Noida Expressway / Kalindi Bypass',
    current_vehicle_density: 1650,
    average_speed: 18.0,
    road_condition: 'High-Speed Merging Traffic from Delhi / Kalindi Kunj',
    congestion_level: 'RED',
    risk_level: 'HIGH',
    noise_level: 86.4,
    incident_count: 1,
    prediction_5min: { queue_m: 850, speed: 16.5, trend: 'INCREASING' },
    prediction_10min: { queue_m: 1100, speed: 15.0, trend: 'INCREASING' },
    prediction_15min: { queue_m: 1300, speed: 13.5, trend: 'STABLE' },
    prediction_30min: { queue_m: 1550, speed: 12.0, trend: 'STABLE' },
    last_updated: new Date().toISOString(),
    incidents: [
      { id: 'INC-NOI-03', type: 'congestion', title: 'Slow Merging Queue onto Greater Noida Expressway', severity: 'MEDIUM', delay_impact_min: 10 }
    ],
    infrastructure_issue: null,
    noise_hotspot: {
      is_hotspot: false,
      noise_db: 86.4,
      classification: 'highway_rumble',
      exposure_risk: 'MEDIUM'
    },
    emergency_corridor: {
      active: true,
      vehicle_id: 'AMB-UP-112',
      destination: 'Jaypee Hospital Sector 128',
      route: ['Mahamaya Flyover', 'Expressway Corridor', 'Sector 128 Loop'],
      target_eta_min: 4.8
    },
    signal_junction: {
      name: 'Mahamaya Loop Signal',
      status: 'Green',
      timer: 45,
      mode: 'corridor_preempt'
    },
    recommendation: {
      action: 'Hold Sector 44 feeder lanes to prioritize emergency ambulance corridor to Jaypee Hospital',
      expected_delay_reduction_percent: 38,
      confidence: 0.92,
      primary_cause: 'Expressway Flyover Merging Interlock'
    }
  },
  {
    zone_id: 'NOIDA-KALINDI-03',
    name: 'Kalindi Kunj - Noida Delhi Border',
    latitude: 28.5458,
    longitude: 77.3115,
    road: 'Kalindi Kunj Marg / Yamuna River Bridge',
    current_vehicle_density: 1950,
    average_speed: 8.5,
    road_condition: 'Interstate Border Bottleneck into South Delhi',
    congestion_level: 'DARK_RED',
    risk_level: 'CRITICAL',
    noise_level: 95.0,
    incident_count: 3,
    prediction_5min: { queue_m: 1600, speed: 7.2, trend: 'CRITICAL' },
    prediction_10min: { queue_m: 1900, speed: 6.0, trend: 'CRITICAL' },
    prediction_15min: { queue_m: 2150, speed: 5.5, trend: 'GRIDLOCK' },
    prediction_30min: { queue_m: 2500, speed: 4.0, trend: 'GRIDLOCK' },
    last_updated: new Date().toISOString(),
    incidents: [
      { id: 'INC-NOI-04', type: 'road_blockage', title: 'Commercial Vehicle Breakdown on Yamuna Bridge', severity: 'HIGH', delay_impact_min: 25 }
    ],
    infrastructure_issue: {
      has_issue: true,
      type: 'debris',
      severity: 'HIGH',
      capacity_reduction_percent: 45,
      work_order_id: 'WO-NOIDA-8815',
      crew: 'Noida Traffic Police Crane Unit 01',
      eta_minutes: 5
    },
    noise_hotspot: {
      is_hotspot: true,
      noise_db: 95.0,
      classification: 'traffic_horn',
      exposure_risk: 'CRITICAL'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'Kalindi Kunj Border Signal',
      status: 'Red',
      timer: 90,
      mode: 'adaptive'
    },
    recommendation: {
      action: 'Advising Noida commuters to use DND Flyway or Okhla Barrage alternate routes',
      expected_delay_reduction_percent: 50,
      confidence: 0.96,
      primary_cause: 'Interstate Capacity Constraint + Vehicle Stalling'
    }
  },
  {
    zone_id: 'NOIDA-BOTANICAL-06',
    name: 'Botanical Garden Metro Interchange Hub',
    latitude: 28.5644,
    longitude: 77.3342,
    road: 'Captain Gaur Vij Marg / Sector 37 Chowk',
    current_vehicle_density: 1200,
    average_speed: 22.0,
    road_condition: 'Multi-Modal Metro & Bus Feeder Transit Zone',
    congestion_level: 'ORANGE',
    risk_level: 'MEDIUM',
    noise_level: 84.1,
    incident_count: 1,
    prediction_5min: { queue_m: 500, speed: 20.0, trend: 'STABLE' },
    prediction_10min: { queue_m: 650, speed: 18.5, trend: 'INCREASING' },
    prediction_15min: { queue_m: 780, speed: 17.0, trend: 'INCREASING' },
    prediction_30min: { queue_m: 950, speed: 15.0, trend: 'STABLE' },
    last_updated: new Date().toISOString(),
    incidents: [],
    infrastructure_issue: null,
    noise_hotspot: {
      is_hotspot: false,
      noise_db: 84.1,
      classification: 'bus_idling',
      exposure_risk: 'MEDIUM'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'Botanical Garden Metro Signal',
      status: 'Green',
      timer: 35,
      mode: 'adaptive'
    },
    recommendation: {
      action: 'Regulate auto-rickshaw pickup bays along Captain Gaur Vij Marg',
      expected_delay_reduction_percent: 30,
      confidence: 0.91,
      primary_cause: 'Metro Passenger Transit Inflow'
    }
  },
  {
    zone_id: 'NOIDA-SEC18-07',
    name: 'Sector 18 Atta Market / DLF Mall Hub',
    latitude: 28.5678,
    longitude: 77.3211,
    road: 'Sector 18 Main Commercial Radial',
    current_vehicle_density: 1550,
    average_speed: 10.0,
    road_condition: 'Shopping & Commercial Multi-Level Parking Entry Queue',
    congestion_level: 'DARK_RED',
    risk_level: 'HIGH',
    noise_level: 89.2,
    incident_count: 2,
    prediction_5min: { queue_m: 900, speed: 9.0, trend: 'INCREASING' },
    prediction_10min: { queue_m: 1200, speed: 7.5, trend: 'CRITICAL' },
    prediction_15min: { queue_m: 1400, speed: 6.8, trend: 'CRITICAL' },
    prediction_30min: { queue_m: 1700, speed: 5.5, trend: 'GRIDLOCK' },
    last_updated: new Date().toISOString(),
    incidents: [
      { id: 'INC-NOI-05', type: 'congestion', title: 'Mall Entry Valet Queue Spilling onto Roadway', severity: 'HIGH', delay_impact_min: 15 }
    ],
    infrastructure_issue: null,
    noise_hotspot: {
      is_hotspot: true,
      noise_db: 89.2,
      classification: 'commercial_traffic',
      exposure_risk: 'HIGH'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'Sector 18 / Atta Market Signal',
      status: 'Yellow',
      timer: 10,
      mode: 'adaptive'
    },
    recommendation: {
      action: 'Open alternate entrance to Multi-Level Car Parking & activate electronic signage',
      expected_delay_reduction_percent: 35,
      confidence: 0.93,
      primary_cause: 'Commercial Parking Overflow'
    }
  },
  {
    zone_id: 'NOIDA-ADVANT-08',
    name: 'Advant Navis Business Park (Sector 142)',
    latitude: 28.5032,
    longitude: 77.4116,
    road: 'Noida-Greater Noida Expressway / Sector 142 Exit',
    current_vehicle_density: 980,
    average_speed: 38.0,
    road_condition: 'Corporate Tech Corridor Expressway Section',
    congestion_level: 'YELLOW',
    risk_level: 'LOW',
    noise_level: 79.5,
    incident_count: 0,
    prediction_5min: { queue_m: 250, speed: 36.0, trend: 'STABLE' },
    prediction_10min: { queue_m: 350, speed: 34.0, trend: 'STABLE' },
    prediction_15min: { queue_m: 450, speed: 32.0, trend: 'STABLE' },
    prediction_30min: { queue_m: 600, speed: 30.0, trend: 'STABLE' },
    last_updated: new Date().toISOString(),
    incidents: [],
    infrastructure_issue: null,
    noise_hotspot: {
      is_hotspot: false,
      noise_db: 79.5,
      classification: 'expressway_cruising',
      exposure_risk: 'LOW'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'Sector 142 Underpass Signal',
      status: 'Green',
      timer: 50,
      mode: 'fixed'
    },
    recommendation: {
      action: 'Maintain free flow speeds; speed camera enforcement active at 80 km/h limit',
      expected_delay_reduction_percent: 15,
      confidence: 0.98,
      primary_cause: 'Free Flowing Expressway Segment'
    }
  },
  {
    zone_id: 'NOIDA-PARICHOWK-13',
    name: 'Pari Chowk Gateway Roundabout',
    latitude: 28.4674,
    longitude: 77.5141,
    road: 'Yamuna Expressway / Greater Noida Main Radial',
    current_vehicle_density: 1400,
    average_speed: 19.5,
    road_condition: 'High-Volume Gateway to Agra / Yamuna Expressway',
    congestion_level: 'ORANGE',
    risk_level: 'MEDIUM',
    noise_level: 87.8,
    incident_count: 1,
    prediction_5min: { queue_m: 650, speed: 18.0, trend: 'INCREASING' },
    prediction_10min: { queue_m: 850, speed: 16.5, trend: 'INCREASING' },
    prediction_15min: { queue_m: 1050, speed: 15.0, trend: 'INCREASING' },
    prediction_30min: { queue_m: 1300, speed: 13.5, trend: 'STABLE' },
    last_updated: new Date().toISOString(),
    incidents: [],
    infrastructure_issue: null,
    noise_hotspot: {
      is_hotspot: false,
      noise_db: 87.8,
      classification: 'intercity_buses',
      exposure_risk: 'MEDIUM'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'Pari Chowk Circle Signal',
      status: 'Green',
      timer: 40,
      mode: 'rotary_flow'
    },
    recommendation: {
      action: 'Divert heavy intercity transport to Eastern Peripheral Expressway bypass',
      expected_delay_reduction_percent: 28,
      confidence: 0.89,
      primary_cause: 'Regional Highway Transit Convergence'
    }
  },
  {
    zone_id: 'NOIDA-DND-11',
    name: 'DND Flyway Toll Plaza Corridor',
    latitude: 28.5752,
    longitude: 77.2942,
    road: 'Delhi-Noida Direct Flyway / Yamuna Bridge',
    current_vehicle_density: 1350,
    average_speed: 26.0,
    road_condition: 'Major High-Capacity Arterial to South & Central Delhi',
    congestion_level: 'ORANGE',
    risk_level: 'LOW',
    noise_level: 83.0,
    incident_count: 0,
    prediction_5min: { queue_m: 400, speed: 25.0, trend: 'STABLE' },
    prediction_10min: { queue_m: 550, speed: 23.5, trend: 'STABLE' },
    prediction_15min: { queue_m: 700, speed: 22.0, trend: 'INCREASING' },
    prediction_30min: { queue_m: 900, speed: 20.0, trend: 'INCREASING' },
    last_updated: new Date().toISOString(),
    incidents: [],
    infrastructure_issue: null,
    noise_hotspot: {
      is_hotspot: false,
      noise_db: 83.0,
      classification: 'highway_traffic',
      exposure_risk: 'LOW'
    },
    emergency_corridor: {
      active: false,
      vehicle_id: null,
      target_eta_min: null
    },
    signal_junction: {
      name: 'DND Noida Entry Plaza',
      status: 'Green',
      timer: 60,
      mode: 'free_flow'
    },
    recommendation: {
      action: 'Maintain open lanes at former toll booths to avoid lane oscillation',
      expected_delay_reduction_percent: 20,
      confidence: 0.94,
      primary_cause: 'Toll Plaza Choke Remnants'
    }
  }
];

export const BANGALORE_CORRIDORS = [
  {
    id: 'CORR-NOIDA-01',
    name: 'Amity University - Expressway Corridor',
    from: 'Mahamaya Flyover (Sector 44)',
    to: 'Advant Navis (Sector 142)',
    length_km: 11.5,
    key_zones: ['NOIDA-MAHAMAYA-02', 'NOIDA-AMITY-01', 'NOIDA-ADVANT-08'],
    status: 'OPTIMIZED'
  },
  {
    id: 'CORR-NOIDA-02',
    name: 'Delhi - Noida Interstate Link',
    from: 'Kalindi Kunj (Delhi Border)',
    to: 'Amity University Sector 125 Gate',
    length_km: 4.8,
    key_zones: ['NOIDA-KALINDI-03', 'NOIDA-AMITY-01'],
    status: 'CONGESTED'
  },
  {
    id: 'CORR-NOIDA-03',
    name: 'Sector 18 Commercial & Metro Corridor',
    from: 'Film City (Sector 16A)',
    to: 'Botanical Garden Metro Hub',
    length_km: 3.2,
    key_zones: ['NOIDA-SEC18-07', 'NOIDA-BOTANICAL-06'],
    status: 'HEAVY'
  }
];

export const NOIDA_ZONES = BANGALORE_ZONES;
export const NOIDA_CORRIDORS = BANGALORE_CORRIDORS;
