/**
 * Frontend Noida & NCR Geospatial Intelligence Configuration
 * Centered on Amity University (Sector 125, Noida, Uttar Pradesh) and Noida-Greater Noida Expressway.
 */

export const BANGALORE_CENTER = {
  lat: 28.5449,
  lng: 77.3331,
  zoom: 13
};

// Also export alias for clean readability
export const NOIDA_CENTER = BANGALORE_CENTER;

export const CONGESTION_CATEGORIES = {
  GREEN: {
    label: 'Normal Flow',
    colorHex: '#10B981',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
    minSpeed: 45,
    description: 'Free flow expressway conditions (> 45 km/h)'
  },
  YELLOW: {
    label: 'Moderate Traffic',
    colorHex: '#F59E0B',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
    minSpeed: 30,
    description: 'Slowing traffic (30-45 km/h)'
  },
  ORANGE: {
    label: 'Heavy Congestion',
    colorHex: '#F97316',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-300',
    minSpeed: 18,
    description: 'Heavy volume backlog (18-30 km/h)'
  },
  RED: {
    label: 'Severe Congestion',
    colorHex: '#EF4444',
    bgClass: 'bg-red-500',
    textClass: 'text-red-700',
    borderClass: 'border-red-300',
    minSpeed: 10,
    description: 'Severe bottleneck & queueing (10-18 km/h)'
  },
  DARK_RED: {
    label: 'Critical Gridlock Hotspot',
    colorHex: '#881337',
    bgClass: 'bg-rose-950',
    textClass: 'text-rose-900',
    borderClass: 'border-rose-800',
    minSpeed: 0,
    description: 'Critical gridlock (< 10 km/h) / Multi-Incident block'
  }
};

export const BANGALORE_LANDMARKS = [
  { id: 'NOIDA-AMITY-01', name: 'Amity University Sector 125 Gate', lat: 28.5449, lng: 77.3331, defaultLevel: 'DARK_RED' },
  { id: 'NOIDA-MAHAMAYA-02', name: 'Mahamaya Flyover Junction', lat: 28.5528, lng: 77.3235, defaultLevel: 'RED' },
  { id: 'NOIDA-KALINDI-03', name: 'Kalindi Kunj - Delhi Border', lat: 28.5458, lng: 77.3115, defaultLevel: 'DARK_RED' },
  { id: 'NOIDA-BIRD-04', name: 'Okhla Bird Sanctuary Metro Hub', lat: 28.5444, lng: 77.3189, defaultLevel: 'YELLOW' },
  { id: 'NOIDA-SEC126-05', name: 'Sector 126 Tech Zone (HCL Gate)', lat: 28.5385, lng: 77.3421, defaultLevel: 'GREEN' },
  { id: 'NOIDA-BOTANICAL-06', name: 'Botanical Garden Metro Interchange', lat: 28.5644, lng: 77.3342, defaultLevel: 'ORANGE' },
  { id: 'NOIDA-SEC18-07', name: 'Sector 18 Atta Market / DLF Mall', lat: 28.5678, lng: 77.3211, defaultLevel: 'DARK_RED' },
  { id: 'NOIDA-ADVANT-08', name: 'Advant Navis Business Park (Sec 142)', lat: 28.5032, lng: 77.4116, defaultLevel: 'YELLOW' },
  { id: 'NOIDA-FILM-09', name: 'Film City / Sector 16A Hub', lat: 28.5662, lng: 77.3118, defaultLevel: 'YELLOW' },
  { id: 'NOIDA-SEC62-10', name: 'Sector 62 Model Town Chowk', lat: 28.6271, lng: 77.3653, defaultLevel: 'RED' },
  { id: 'NOIDA-DND-11', name: 'DND Flyway Tollway (Delhi-Noida)', lat: 28.5752, lng: 77.2942, defaultLevel: 'ORANGE' },
  { id: 'NOIDA-SEC128-12', name: 'Sector 128 Jaypee Wish Town', lat: 28.5192, lng: 77.3718, defaultLevel: 'GREEN' },
  { id: 'NOIDA-PARICHOWK-13', name: 'Pari Chowk, Greater Noida Gateway', lat: 28.4674, lng: 77.5141, defaultLevel: 'ORANGE' },
  { id: 'NOIDA-SEC76-14', name: 'Sector 76 Metro / Spectrum Hub', lat: 28.5724, lng: 77.3855, defaultLevel: 'GREEN' },
  { id: 'NOIDA-SEC93-15', name: 'Sector 93 Grand Omaxe Junction', lat: 28.5147, lng: 77.3812, defaultLevel: 'YELLOW' },
  { id: 'NOIDA-AUTHORITY-16', name: 'Noida Authority Complex (Sec 6)', lat: 28.5992, lng: 77.3184, defaultLevel: 'GREEN' }
];

export const NOIDA_LANDMARKS = BANGALORE_LANDMARKS;
