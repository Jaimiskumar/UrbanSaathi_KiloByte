import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Activity, 
  Clock, 
  Siren, 
  Volume2, 
  Wrench, 
  Shield, 
  Zap, 
  Layers, 
  RotateCw, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  RefreshCw, 
  ChevronRight, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  SlidersHorizontal,
  Flame,
  Radio,
  Eye,
  Sliders,
  Sparkles,
  Search,
  ExternalLink,
  Map as MapIcon,
  Building2,
  Car,
  Layers2,
  Crosshair,
  Satellite,
  Gauge,
  Route,
  ArrowRight,
  ShieldCheck,
  Fuel,
  GitFork,
  Check
} from 'lucide-react';
import { BANGALORE_LANDMARKS, CONGESTION_CATEGORIES, BANGALORE_CENTER } from '../../config/bangaloreGeospatial';

export default function BangaloreTrafficMap() {
  // Operational City Selector State
  const [selectedCity, setSelectedCity] = useState('bengaluru');
  const [zones, setZones] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'HIGH'
  const [searchQuery, setSearchQuery] = useState('');

  // Right Panel Tab State: 'hotspots' | 'routing' | 'detections'
  const [activeRightTab, setActiveRightTab] = useState('hotspots');

  // Map View Mode: 'google_traffic' | 'routing' | 'satellite' | 'ai_telemetry'
  const [mapViewMode, setMapViewMode] = useState('google_traffic');
  const [mapZoom, setMapZoom] = useState(14);

  // ── AI Dynamic Routing State ──
  const [routeOrigin, setRouteOrigin] = useState('Silk Board Junction');
  const [routeDestination, setRouteDestination] = useState('Electronic City Toll');
  const [selectedRouteType, setSelectedRouteType] = useState('ai_optimal'); // 'ai_optimal' | 'congested_primary' | 'alternate'
  const [isRoutingActive, setIsRoutingActive] = useState(false);

  // Pre-configured Bangalore Corridors for Routing
  const routePresets = [
    { label: 'Silk Board ➡️ Electronic City', origin: 'Silk Board Junction', dest: 'Electronic City Toll' },
    { label: 'Smart Horizon ➡️ Bellandur ORR', origin: 'Smart Horizon College Campus Hub', dest: 'Outer Ring Road - Bellandur' },
    { label: 'Koramangala ➡️ KR Puram / Tin Factory', origin: 'Koramangala Sony World', dest: 'KR Puram / Tin Factory' },
    { label: 'Majestic Hub ➡️ Whitefield ITPL', origin: 'Majestic Kempegowda Hub', dest: 'Whitefield / Hope Farm' },
    { label: 'Hebbal Flyover ➡️ Silk Board Express', origin: 'Hebbal Flyover', dest: 'Silk Board Junction' }
  ];

  // AI Route Computation Metrics
  const calculatedRoutes = {
    ai_optimal: {
      id: 'ai_optimal',
      name: 'AI Smart Bypass Route (Green Wave)',
      via: 'Via 27th Main HSR & Intermediate Flyover Bypass',
      duration: '22 mins',
      distance: '15.8 km',
      delay: '0 mins',
      timeSaved: '26 mins (-54%)',
      fuelSaved: '1.2 Litres',
      status: 'FREE_FLOW',
      color: 'emerald',
      signalsSynchronized: 8,
      speed: '44 km/h'
    },
    congested_primary: {
      id: 'congested_primary',
      name: 'Standard Arterial Route (Severe Bottleneck)',
      via: 'Via Main Hosur Elevated & Central Corridor',
      duration: '48 mins',
      distance: '14.2 km',
      delay: '+26 mins delay',
      timeSaved: '0 mins',
      fuelSaved: '0 L',
      status: 'DARK_RED',
      color: 'rose',
      signalsSynchronized: 2,
      speed: '9.2 km/h'
    },
    alternate: {
      id: 'alternate',
      name: 'Outer Ring Road Service Corridor',
      via: 'Via Service Road & Koramangala 80ft link',
      duration: '33 mins',
      distance: '16.5 km',
      delay: '+11 mins delay',
      timeSaved: '15 mins (-31%)',
      fuelSaved: '0.6 Litres',
      status: 'ORANGE',
      color: 'amber',
      signalsSynchronized: 5,
      speed: '28 km/h'
    }
  };

  // ── Live AI Incident & Road Hazard Detections ──
  const [detectedIncidents, setDetectedIncidents] = useState([
    {
      id: 'DET-INC-001',
      type: 'pothole',
      title: 'Deep Hazardous Pothole (14cm depth)',
      location: 'Silk Board Flyover South Ramp',
      coords: { lat: 12.9176, lng: 77.6238 },
      confidence: 98.4,
      severity: 'CRITICAL',
      detectedAt: '3m ago',
      workOrderId: 'BBMP-WO-9021',
      workOrderStatus: 'DISPATCHED_TO_ASPHALT_CREW',
      sensorSource: 'Connected Vehicle Dashcam #KA-01-MJ-4821',
      mitigationAction: 'V2V Hazard Broadcast + Speed Advisory 25km/h'
    },
    {
      id: 'DET-INC-002',
      type: 'stalled_vehicle',
      title: 'Heavy Truck Stalled in Middle Lane',
      location: 'KR Puram / Tin Factory Hanging Bridge',
      coords: { lat: 13.0075, lng: 77.6959 },
      confidence: 96.8,
      severity: 'DARK_RED',
      detectedAt: '7m ago',
      workOrderId: 'BTP-TOW-4412',
      workOrderStatus: 'EMERGENCY_TOW_EN_ROUTE',
      sensorSource: 'CCTV AI Camera CAM-KR-04',
      mitigationAction: 'Dynamic Lane Inversion + Divert via Hoodi Circle'
    },
    {
      id: 'DET-INC-003',
      type: 'waterlogging',
      title: 'Severe Waterlogging / Monsoonal Ponding',
      location: 'Outer Ring Road - Bellandur EcoSpace',
      coords: { lat: 12.9304, lng: 77.6784 },
      confidence: 99.1,
      severity: 'HIGH',
      detectedAt: '12m ago',
      workOrderId: 'BWSSB-PUMP-8831',
      workOrderStatus: 'PUMPING_CREW_ACTIVE',
      sensorSource: 'UrbanFlow Multi-Modal Flood Sensor FS-02',
      mitigationAction: 'Activate Staggered Tech Park Exit Signal Waves'
    },
    {
      id: 'DET-INC-004',
      type: 'crosswalk_conflict',
      title: 'Pedestrian Surge / Crosswalk Conflict',
      location: 'Madiwala Metro Station Crosswalk',
      coords: { lat: 12.9226, lng: 77.6174 },
      confidence: 95.7,
      severity: 'MEDIUM',
      detectedAt: '18m ago',
      workOrderId: 'BTP-SIGNAL-1204',
      workOrderStatus: 'AI_GREEN_PHASE_EXTENDED',
      sensorSource: 'SAMVED YOLO-v11 Pedestrian Vision Stream',
      mitigationAction: 'Pedestrian Shield Active (Walk phase +25s)'
    }
  ]);

  // Map Layer Visibility Toggles
  const [activeLayers, setActiveLayers] = useState({
    hotspots: true,
    incidents: true,
    predictions: true,
    infrastructure: true,
    emergency: true,
    noise: true,
    signals: true,
    corridors: true
  });

  // Socket.IO Live Events Feed
  const [recentLiveEvents, setRecentLiveEvents] = useState([]);

  // 1. Fetch Bangalore Zones & Hotspots from Backend
  const fetchBangaloreData = async () => {
    try {
      const [zonesRes, hotspotsRes] = await Promise.all([
        axios.get('/api/bangalore/zones'),
        axios.get('/api/bangalore/hotspots')
      ]);

      if (zonesRes.data?.zones) {
        setZones(zonesRes.data.zones);
        if (!selectedZone) {
          const defaultSilk = zonesRes.data.zones.find(z => z.zone_id === 'BLR-SILK-01') || zonesRes.data.zones[0];
          setSelectedZone(defaultSilk);
        }
      }

      if (hotspotsRes.data?.hotspots) {
        setHotspots(hotspotsRes.data.hotspots);
      }
    } catch (err) {
      console.warn('Bangalore API fetch fallback to local landmarks:', err.message);
      setZones(BANGALORE_LANDMARKS.map(lm => ({
        zone_id: lm.id,
        name: lm.name,
        latitude: lm.lat,
        longitude: lm.lng,
        road: 'Bangalore Arterial Network',
        current_vehicle_density: 1500,
        average_speed: 12.0,
        congestion_level: lm.defaultLevel,
        risk_level: lm.defaultLevel === 'DARK_RED' ? 'CRITICAL' : 'HIGH',
        noise_level: 88.0,
        incident_count: lm.defaultLevel === 'DARK_RED' ? 2 : 1,
        prediction_30min: { queue_m: 1400, speed: 8.0, trend: 'HIGH' },
        recommendation: { action: 'Dynamic Signal Offset', expected_delay_reduction_percent: 35, confidence: 0.92 }
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBangaloreData();
    const interval = setInterval(fetchBangaloreData, 15000);
    return () => clearInterval(interval);
  }, []);

  // 2. Real-Time Socket.IO Synchronization
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    socket.on('bangalore_zone_updated', (updatedZone) => {
      setZones(prev => prev.map(z => z.zone_id === updatedZone.zone_id ? updatedZone : z));
      setRecentLiveEvents(prev => [{
        id: Date.now(),
        type: 'ZONE_UPDATE',
        text: `Live update at ${updatedZone.name}: ${updatedZone.average_speed} km/h (${updatedZone.congestion_level})`,
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 10));
    });

    socket.on('green_corridor_activated', (data) => {
      toast.success(`🚑 Bengaluru Green Corridor Active: ${data.vehicleId || 'AMB-BLR-07'} to ${data.destination || 'Hospital'}!`, { duration: 6000 });
      setRecentLiveEvents(prev => [{
        id: Date.now(),
        type: 'GREEN_CORRIDOR',
        text: `Green Wave Active for ${data.vehicleId || 'AMB-BLR-07'} (${data.destination || 'Hospital'})`,
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 10));
      fetchBangaloreData();
    });

    socket.on('bangalore_incident_created', (data) => {
      toast.error(`⚠️ New Incident Ingested: ${data.title} in ${data.zone_id}`, { duration: 5000 });
      fetchBangaloreData();
    });

    return () => socket.disconnect();
  }, []);

  const toggleLayer = (layerKey) => {
    setActiveLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const focusOnZone = (zone) => {
    setSelectedZone(zone);
    setMapZoom(15);
  };

  // Trigger Emergency Green Wave Demo
  const triggerBangaloreGreenCorridor = async () => {
    try {
      const payload = {
        vehicleId: 'AMB-BLR-99',
        destination: 'Smart Horizon College Campus Hub',
        startIntersection: 'SIG001',
        endIntersection: 'SIG002',
        hospitalName: 'Bengaluru Smart City Trauma Center'
      };
      const res = await axios.post('/api/bangalore/green-corridor', payload);
      toast.success(res.data?.message || '🚑 Bengaluru Green Wave Signal Corridor Deployed across Hosur Road Corridor!', { duration: 6000 });
      fetchBangaloreData();
    } catch (e) {
      console.error('Green Corridor error:', e);
      toast.error('Failed to trigger Green Corridor. Retrying...');
    }
  };

  // Broadcast AI Route Diversion to Connected Vehicles
  const activateRouteDiversion = () => {
    setIsRoutingActive(true);
    toast.success(`📡 AI Diversion Activated: Rerouting ${routeOrigin} ➡️ ${routeDestination} via ${calculatedRoutes[selectedRouteType].via}! Broadcasted to all Connected Vehicles.`, { duration: 6000 });
  };

  // Seamlessly Activate AI Dynamic Routing
  const handleOpenGoogleDirections = () => {
    const origin = selectedZone?.name || routeOrigin || 'Silk Board Junction';
    let destination = routeDestination;

    // Smart corridor destination inference based on selected origin
    if (origin.toLowerCase().includes('silk board')) {
      destination = 'Electronic City Toll';
    } else if (origin.toLowerCase().includes('smart horizon')) {
      destination = 'Outer Ring Road - Bellandur';
    } else if (origin.toLowerCase().includes('koramangala')) {
      destination = 'KR Puram / Tin Factory';
    } else if (origin.toLowerCase().includes('hebbal')) {
      destination = 'Silk Board Junction';
    } else if (origin.toLowerCase().includes('majestic')) {
      destination = 'Whitefield / Hope Farm';
    } else if (!destination || destination === origin) {
      destination = 'Smart Horizon College Campus Hub';
    }

    setRouteOrigin(origin);
    setRouteDestination(destination);
    setMapViewMode('routing');
    setActiveRightTab('routing');
    setIsRoutingActive(true);

    toast.success(`🧭 AI Routing Active: ${origin} ➔ ${destination} (Optimal: ${calculatedRoutes.ai_optimal.duration}, -54% delay)`, {
      icon: '🧭',
      duration: 5000
    });
  };

  const handleOpenExternalGoogleMaps = () => {
    const origin = routeOrigin || selectedZone?.name || 'Silk Board Junction';
    const destination = routeDestination || 'Electronic City';
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin + ' Bengaluru')}&destination=${encodeURIComponent(destination + ' Bengaluru')}`;
    window.open(url, '_blank');
  };

  // Build high-definition embed URL for Google Maps
  const getGoogleMapsEmbedUrl = () => {
    const base = "https://maps.google.com/maps";
    
    // Route Directions Mode
    if (mapViewMode === 'routing') {
      const origin = routeOrigin ? `${routeOrigin}, Bengaluru, Karnataka` : "Silk Board Junction, Bengaluru, Karnataka";
      const destination = routeDestination ? `${routeDestination}, Bengaluru, Karnataka` : "Electronic City, Bengaluru, Karnataka";
      return `${base}?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&t=m&output=embed`;
    }

    // Standard / Satellite / AI Mode
    let target = selectedZone ? `${selectedZone.name}, Bengaluru, Karnataka` : "Silk Board Junction, Bengaluru, Karnataka";
    if (searchQuery.trim()) {
      target = `${searchQuery.trim()}, Bengaluru, Karnataka`;
    }
    const mapType = mapViewMode === 'satellite' ? 'k' : 'm';
    return `${base}?q=${encodeURIComponent(target)}&t=${mapType}&z=${mapZoom}&output=embed&iwloc=near`;
  };

  // Filtered hotspots list
  const filteredHotspots = hotspots.filter(h => {
    const matchesSeverity = filterSeverity === 'ALL' || 
      (filterSeverity === 'CRITICAL' && (h.current_congestion === 'DARK_RED' || h.risk_level === 'CRITICAL')) ||
      (filterSeverity === 'HIGH' && (h.current_congestion === 'RED' || h.risk_level === 'HIGH'));
    
    const matchesSearch = searchQuery === '' || 
      h.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.road.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSeverity && matchesSearch;
  });

  const keyCorridors = [
    { id: 'BLR-SILK-01', name: 'Silk Board', fullName: 'Silk Board Junction', icon: '🚦', level: 'DARK_RED' },
    { id: 'BLR-BELLANDUR-06', name: 'Bellandur ORR', fullName: 'Outer Ring Road - Bellandur', icon: '🌐', level: 'DARK_RED' },
    { id: 'BLR-KRPURAM-04', name: 'KR Puram / Tin Factory', fullName: 'KR Puram / Tin Factory', icon: '🌉', level: 'DARK_RED' },
    { id: 'BLR-HEBBAL-05', name: 'Hebbal Flyover', fullName: 'Hebbal Flyover', icon: '✈️', level: 'RED' },
    { id: 'BLR-ECITY-02', name: 'Electronic City', fullName: 'Electronic City Toll', icon: '⚡', level: 'ORANGE' },
    { id: 'BLR-MAJESTIC-12', name: 'Majestic Hub', fullName: 'Majestic Kempegowda Hub', icon: '🏛️', level: 'DARK_RED' },
    { id: 'BLR-HORIZON-16', name: 'Smart Horizon Campus', fullName: 'Smart Horizon College Campus Hub', icon: '🎓', level: 'GREEN' }
  ];

  return (
    <div className="space-y-6 pb-20 max-w-[1700px] mx-auto">
      
      {/* ── Header: Operational City Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="bg-blue-500 text-white text-[10px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Primary Operational City (Live Demo)
              </span>
              <span className="text-slate-400 text-xs font-bold font-mono">
                Lat: 12.9716° N • Lng: 77.5946° E
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              Bengaluru Traffic Intelligence & AI Routing Map
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Real-time multi-modal geospatial telemetry, turn-by-turn AI diversion routing, and live road hazard perception across Silk Board, Bellandur, Hebbal, and Smart Horizon College corridors.
            </p>
          </div>

          {/* City Mode & Status Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 flex items-center">
              <button
                onClick={() => setSelectedCity('bengaluru')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedCity === 'bengaluru' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Bengaluru (Primary)
              </button>
              <button
                onClick={() => setSelectedCity('smart-horizon')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCity === 'smart-horizon' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Smart Horizon Campus (Node)
              </button>
            </div>

            <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700 text-center min-w-[120px]">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Tracked Zones</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">{zones.length}</p>
            </div>
          </div>
        </div>

        {/* ── Quick Corridor Navigation Strip ── */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0 flex items-center gap-1">
            <Crosshair className="w-3.5 h-3.5 text-blue-400" /> Jump Corridor:
          </span>
          {keyCorridors.map((corridor) => {
            const isSelected = selectedZone?.name === corridor.fullName || selectedZone?.zone_id === corridor.id;
            return (
              <button
                key={corridor.id}
                onClick={() => {
                  const targetZone = zones.find(z => z.name === corridor.fullName || z.zone_id === corridor.id) || {
                    zone_id: corridor.id,
                    name: corridor.fullName,
                    latitude: BANGALORE_LANDMARKS.find(l => l.id === corridor.id)?.lat || 12.9176,
                    longitude: BANGALORE_LANDMARKS.find(l => l.id === corridor.id)?.lng || 77.6238,
                    average_speed: 8.5,
                    congestion_level: corridor.level,
                    current_vehicle_density: 1750,
                    noise_level: 88.5,
                    prediction_30min: { queue_m: 1950, speed: 7.2, trend: 'HIGH' },
                    recommendation: { action: `Reroute traffic along ${corridor.name} arterial corridor & extend green phase`, expected_delay_reduction_percent: 40, confidence: 0.95 }
                  };
                  focusOnZone(targetZone);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 border border-blue-400'
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span>{corridor.icon}</span>
                <span>{corridor.name}</span>
                {corridor.level === 'DARK_RED' && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* ── Layer Toggles Toolbar ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Layers:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'hotspots', label: 'Congestion Hotspots', icon: Flame, color: 'text-rose-600 bg-rose-50 border-rose-200' },
            { id: 'incidents', label: 'Road Incidents', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { id: 'predictions', label: 'Queue Predictions', icon: TrendingUp, color: 'text-purple-600 bg-purple-50 border-purple-200' },
            { id: 'infrastructure', label: 'Potholes / Work Orders', icon: Wrench, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { id: 'emergency', label: 'Emergency Vehicles & Waves', icon: Siren, color: 'text-red-600 bg-red-50 border-red-200' },
            { id: 'noise', label: 'Noise Hotspots', icon: Volume2, color: 'text-orange-600 bg-orange-50 border-orange-200' },
            { id: 'signals', label: 'Signal Junctions', icon: Zap, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
          ].map((layer) => {
            const isActive = activeLayers[layer.id];
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isActive 
                    ? layer.color + ' shadow-xs' 
                    : 'text-slate-400 bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>

        <button 
          onClick={fetchBangaloreData}
          className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all text-xs font-bold flex items-center gap-1"
          title="Refresh Feed"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Main Map & Telemetry Split View ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Interactive Map Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="bg-[#0F172A] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative h-[680px] flex flex-col justify-between select-none">
            
            {/* Map Floating HUD Header */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
              
              {/* Selected Node Status Pill */}
              <div className="bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700 pointer-events-auto shadow-xl flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-white truncate max-w-[220px]">
                      {mapViewMode === 'routing' ? `${routeOrigin} ➔ ${routeDestination}` : (selectedZone?.name || 'Silk Board Junction')}
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 font-mono">
                      {mapViewMode === 'routing' ? 'AI ROUTE' : 'LIVE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {mapViewMode === 'routing' ? `Optimal ETA: ${calculatedRoutes.ai_optimal.duration} • -54% delay` : `Avg Speed: ${selectedZone?.average_speed || '6.5'} km/h • Zoom: ${mapZoom}x`}
                  </p>
                </div>
              </div>

              {/* View Mode Toggle & Zoom Controls */}
              <div className="bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 pointer-events-auto flex items-center gap-1.5 shadow-xl">
                
                {/* Mode Buttons */}
                <button
                  onClick={() => setMapViewMode('google_traffic')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    mapViewMode === 'google_traffic'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Google Traffic Map"
                >
                  <MapIcon className="w-3.5 h-3.5" /> Traffic
                </button>

                <button
                  onClick={() => {
                    setMapViewMode('routing');
                    setActiveRightTab('routing');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    mapViewMode === 'routing'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="AI Multi-Path Dynamic Routing"
                >
                  <Route className="w-3.5 h-3.5" /> AI Routing
                </button>

                <button
                  onClick={() => setMapViewMode('satellite')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    mapViewMode === 'satellite'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Satellite Aerial Imagery"
                >
                  <Satellite className="w-3.5 h-3.5" /> Satellite
                </button>

                <button
                  onClick={() => setMapViewMode('ai_telemetry')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    mapViewMode === 'ai_telemetry'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 border border-cyan-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="AI Cyber Digital Twin & Telemetry Grid"
                >
                  <Activity className="w-3.5 h-3.5 animate-pulse" /> AI Cyber Twin
                </button>

                <div className="w-[1px] h-5 bg-slate-700 mx-1"></div>

                {/* Zoom Controls */}
                <button 
                  onClick={() => setMapZoom(prev => Math.min(prev + 1, 18))}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setMapZoom(prev => Math.max(prev - 1, 11))}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setMapZoom(14); setSelectedZone(zones.find(z => z.zone_id === 'BLR-SILK-01') || zones[0]); }}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold font-mono"
                  title="Reset View"
                >
                  Reset
                </button>
              </div>

            </div>

            {/* ── MAP CANVAS RENDERING ── */}
            <div className="w-full h-full relative overflow-hidden bg-slate-950">
              
              {/* Real-time Embedded Map Viewport */}
              <iframe 
                src={getGoogleMapsEmbedUrl()}
                width="100%" 
                height="100%" 
                style={{ 
                  border: 0, 
                  filter: mapViewMode === 'ai_telemetry' 
                    ? 'invert(92%) hue-rotate(180deg) brightness(85%) contrast(140%) saturate(1.8)' 
                    : (mapViewMode === 'satellite' ? 'contrast(1.1) saturate(1.15)' : 'contrast(1.05) saturate(1.1)') 
                }} 
                allowFullScreen="" 
                loading="lazy"
                title="Bengaluru High-Definition Traffic Intelligence Map"
                className="w-full h-full transition-all duration-700"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              ></iframe>

              {/* ⚡ ADVANCED HOLOGRAPHIC CYBER HUD OVERLAY (Active in AI Cyber Twin Mode) */}
              {mapViewMode === 'ai_telemetry' && (
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                  
                  {/* Cyber Grid Scanning Scanlines & Grid Overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c710_1px,transparent_1px),linear-gradient(to_bottom,#0284c710_1px,transparent_1px)] bg-[size:40px_40px] opacity-40"></div>

                  {/* Rotating Holographic Radar Sweep */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none opacity-35 animate-spin" style={{ animationDuration: '12s', background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(6, 182, 212, 0.15) 330deg, rgba(56, 189, 248, 0.5) 360deg)' }}></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full border border-cyan-500/20 pointer-events-none"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-cyan-500/30 border-dashed pointer-events-none"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full border border-cyan-400/40 pointer-events-none"></div>

                  {/* Top Cyber Command Telemetry Bar */}
                  <div className="absolute top-18 left-4 right-4 flex items-center justify-between pointer-events-auto">
                    <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-500/40 text-cyan-300 text-[10px] font-mono flex items-center gap-3 shadow-lg shadow-cyan-950/50">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                        AI CORE: <span className="text-emerald-400">14/14 ONLINE</span>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>FPS: <strong className="text-white">60.0</strong></span>
                      <span className="text-slate-600">|</span>
                      <span>TELEMETRY SYNC: <strong className="text-emerald-400">&lt;15ms</strong></span>
                      <span className="text-slate-600">|</span>
                      <span>CONSENSUS: <strong className="text-cyan-400">OPTIMAL</strong></span>
                    </div>

                    <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-lg">
                      MODE: <strong className="text-amber-400">DYNAMIC MULTI-AGENT INFERENCE</strong>
                    </div>
                  </div>

                  {/* Cyber Node Targeting Reticle (Over Selected Zone) */}
                  {selectedZone && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full border-2 border-cyan-400/80 animate-ping opacity-60"></div>
                      <div className="absolute -top-10 bg-slate-950/95 border border-cyan-400 text-cyan-300 px-3 py-1 rounded-lg text-[10px] font-mono font-black shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                        <Crosshair className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                        TARGET LOCKED: {selectedZone.name}
                      </div>
                    </div>
                  )}

                  {/* Corner Sci-Fi HUD Brackets */}
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-500/80 pointer-events-none"></div>
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-500/80 pointer-events-none"></div>
                  <div className="absolute bottom-16 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-500/80 pointer-events-none"></div>
                  <div className="absolute bottom-16 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-500/80 pointer-events-none"></div>

                </div>
              )}

              {/* 🧭 ROUTING HUD OVERLAY (Active when viewing AI Route) */}
              {mapViewMode === 'routing' && (
                <div className="absolute bottom-16 left-4 right-4 z-10 pointer-events-none">
                  <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/50 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pointer-events-auto">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                        <Route className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-white">{calculatedRoutes[selectedRouteType].name}</h4>
                          <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono">
                            {calculatedRoutes[selectedRouteType].timeSaved}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {calculatedRoutes[selectedRouteType].via} • {calculatedRoutes[selectedRouteType].duration} ({calculatedRoutes[selectedRouteType].distance})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={activateRouteDiversion}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                      >
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        Broadcast V2V Diversion
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Map Floating Footer Legend & Emergency Action Bar */}
            <div className="p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-20">
              
              {/* Congestion Scale Legend */}
              <div className="flex items-center gap-3 flex-wrap text-[11px] font-bold text-slate-300">
                <span className="text-slate-500 uppercase text-[10px] font-black">Congestion Scale:</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal (&gt;35k)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Heavy</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Severe</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-950 border border-rose-500"></span> Critical Gridlock (&lt;8k)</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenGoogleDirections}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95 shrink-0"
                >
                  <Route className="w-3.5 h-3.5" />
                  Get AI Directions
                </button>

                <button
                  onClick={handleOpenExternalGoogleMaps}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border border-slate-700"
                  title="Open in Google Maps in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={triggerBangaloreGreenCorridor}
                  className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all active:scale-95 shrink-0"
                >
                  <Siren className="w-3.5 h-3.5" />
                  Test Hosur Green Wave
                </button>
              </div>

            </div>

          </div>

          {/* Live Socket.IO Ticker for Bangalore Events */}
          {recentLiveEvents.length > 0 && (
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 truncate">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-black text-[10px]">LIVE FEED</span>
                <span className="text-slate-300 truncate">{recentLiveEvents[0].text}</span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">[{recentLiveEvents[0].time}]</span>
            </div>
          )}

        </div>

        {/* RIGHT: Tabbed Telemetry, Routing & Detection Command Center (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ── Tab Switcher Header ── */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => {
                setActiveRightTab('hotspots');
                if (mapViewMode === 'routing') setMapViewMode('google_traffic');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeRightTab === 'hotspots'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" /> Hotspots
            </button>

            <button
              onClick={() => {
                setActiveRightTab('routing');
                setMapViewMode('routing');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeRightTab === 'routing'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Route className="w-3.5 h-3.5 text-emerald-500" /> AI Routing
            </button>

            <button
              onClick={() => {
                setActiveRightTab('detections');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeRightTab === 'detections'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-blue-500" /> Detects
            </button>
          </div>

          {/* ── TAB 1: Hotspots Ranked List Panel ── */}
          {activeRightTab === 'hotspots' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Bengaluru Critical Hotspots
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Ranked by severity & traffic delay impact</p>
                  </div>
                </div>
                <span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-0.5 rounded-full font-mono">
                  {filteredHotspots.length} Active
                </span>
              </div>

              {/* Search & Severity Filter Bar */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Silk Board, Hebbal, ORR, Bellandur..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-1">
                  {['ALL', 'CRITICAL', 'HIGH'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => setFilterSeverity(sev)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        filterSeverity === sev 
                          ? 'bg-slate-900 text-white' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hotspot Scrollable List */}
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {filteredHotspots.map(h => {
                  const isSelected = selectedZone?.zone_id === h.zone_id;
                  const cat = CONGESTION_CATEGORIES[h.current_congestion] || CONGESTION_CATEGORIES.RED;
                  return (
                    <div
                      key={h.zone_id}
                      onClick={() => focusOnZone(h)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-500 shadow-sm' 
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-black text-slate-900 truncate">{h.location}</h4>
                        <span 
                          className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase text-white font-mono"
                          style={{ backgroundColor: cat.colorHex }}
                        >
                          {h.current_congestion.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium truncate mb-2">{h.road}</p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-xl border border-slate-200/60 mb-2 font-mono">
                        <div>
                          <span className="text-slate-400 text-[9px] block uppercase">Avg Speed:</span>
                          <strong className="text-rose-600 font-black">{h.average_speed} km/h</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block uppercase">30m Queue:</span>
                          <strong className="text-blue-600 font-black">{h.prediction_30min?.queue_m || 1500} m</strong>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-600 font-medium line-clamp-1">
                        💡 <strong className="text-slate-800">Action:</strong> {h.recommended_action}
                      </p>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ── TAB 2: AI Dynamic Routing Engine ── */}
          {activeRightTab === 'routing' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Route className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      AI Multi-Path Routing
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Real-time bypass & green wave optimization</p>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono uppercase">
                  V2V Sync Active
                </span>
              </div>

              {/* Corridor Presets */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Popular Corridors:</label>
                <div className="flex flex-wrap gap-1.5">
                  {routePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setRouteOrigin(preset.origin);
                        setRouteDestination(preset.dest);
                        setMapViewMode('routing');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        routeOrigin === preset.origin && routeDestination === preset.dest
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Origin & Destination Selector */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/70 font-mono text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Origin (A)</label>
                  <input
                    type="text"
                    value={routeOrigin}
                    onChange={(e) => setRouteOrigin(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-center -my-1">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Destination (B)</label>
                  <input
                    type="text"
                    value={routeDestination}
                    onChange={(e) => setRouteDestination(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Calculated Multi-Route Comparison Cards */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Calculated Multi-Paths:</label>

                {/* Optimal Route */}
                <div
                  onClick={() => setSelectedRouteType('ai_optimal')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    selectedRouteType === 'ai_optimal'
                      ? 'bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded uppercase">
                      ⭐ AI Recommended (Fastest)
                    </span>
                    <strong className="text-emerald-600 font-black text-sm">{calculatedRoutes.ai_optimal.duration}</strong>
                  </div>
                  <p className="text-xs font-black text-slate-900 mt-1">{calculatedRoutes.ai_optimal.via}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2">
                    <span>Dist: {calculatedRoutes.ai_optimal.distance}</span>
                    <span className="text-emerald-600 font-bold">{calculatedRoutes.ai_optimal.timeSaved}</span>
                    <span>Signals: {calculatedRoutes.ai_optimal.signalsSynchronized} Sync</span>
                  </div>
                </div>

                {/* Congested Route */}
                <div
                  onClick={() => setSelectedRouteType('congested_primary')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    selectedRouteType === 'congested_primary'
                      ? 'bg-rose-50/80 border-rose-500 shadow-md ring-2 ring-rose-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase">
                      Primary Highway (Heavy Bottleneck)
                    </span>
                    <strong className="text-rose-600 font-black text-sm">{calculatedRoutes.congested_primary.duration}</strong>
                  </div>
                  <p className="text-xs font-black text-slate-900 mt-1">{calculatedRoutes.congested_primary.via}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2">
                    <span>Dist: {calculatedRoutes.congested_primary.distance}</span>
                    <span className="text-rose-600 font-bold">{calculatedRoutes.congested_primary.delay}</span>
                    <span>Avg Speed: {calculatedRoutes.congested_primary.speed}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={activateRouteDiversion}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                Deploy AI Diversion Wave
              </button>

            </div>
          )}

          {/* ── TAB 3: AI Perception & Hazard Detections ── */}
          {activeRightTab === 'detections' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      AI Incident Detections
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Vision ML & automated BBMP work orders</p>
                  </div>
                </div>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono">
                  {detectedIncidents.length} Active
                </span>
              </div>

              {/* Detected Incidents List */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {detectedIncidents.map(inc => (
                  <div
                    key={inc.id}
                    onClick={() => {
                      setSelectedZone({
                        zone_id: inc.id,
                        name: inc.location,
                        latitude: inc.coords.lat,
                        longitude: inc.coords.lng,
                        average_speed: 6.0,
                        congestion_level: inc.severity === 'CRITICAL' || inc.severity === 'DARK_RED' ? 'DARK_RED' : 'RED',
                        recommendation: { action: inc.mitigationAction, expected_delay_reduction_percent: 45, confidence: inc.confidence / 100 }
                      });
                      setMapZoom(16);
                    }}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-400 transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                          {inc.type === 'pothole' ? <Wrench className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{inc.title}</h4>
                          <p className="text-[10px] text-slate-500 font-mono">{inc.location}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase font-mono shrink-0">
                        {inc.confidence}% Conf
                      </span>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-slate-200 text-[10px] font-mono space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Work Order:</span>
                        <strong className="text-blue-600 font-bold">{inc.workOrderId}</strong>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Status:</span>
                        <strong className="text-emerald-600 font-bold">{inc.workOrderStatus}</strong>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Sensor:</span>
                        <span className="text-slate-700 truncate max-w-[170px]">{inc.sensorSource}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-600 font-medium">
                      💡 <strong className="text-slate-800">Action:</strong> {inc.mitigationAction}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ── Selected Zone Detail Drawer (Always Visible Below Active Tab) ── */}
          {selectedZone && activeRightTab === 'hotspots' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 font-mono block uppercase">
                    {selectedZone.zone_id}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{selectedZone.name}</h3>
                  <p className="text-xs text-slate-500">{selectedZone.road || 'Bengaluru Arterial Grid'}</p>
                </div>
                <button
                  onClick={() => focusOnZone(selectedZone)}
                  className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                  title="Focus Map"
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              </div>

              {/* Metric Badges */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Average Speed</span>
                  <p className="text-xl font-black text-rose-600">{selectedZone.average_speed || 8.5} km/h</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Vehicle Density</span>
                  <p className="text-xl font-black text-slate-900">{selectedZone.current_vehicle_density || 1600} /km²</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Noise Telemetry</span>
                  <p className="text-xl font-black text-orange-600">{selectedZone.noise_level || 88.0} dB</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Signal Mode</span>
                  <p className="text-sm font-black text-emerald-600 uppercase mt-1">Adaptive AI</p>
                </div>
              </div>

              {/* 30-Min Queue Projection */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" /> 30-Min Spillover Forecast
                  </span>
                  <span className="text-[10px] font-black font-mono text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                    {selectedZone.congestion_level === 'DARK_RED' ? 'GRIDLOCK' : 'HIGH QUEUE'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                  <div className="bg-white p-2 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-slate-400 block font-sans">5 min</span>
                    <strong className="text-slate-800 font-black">{Math.round((selectedZone.prediction_30min?.queue_m || 1500) * 0.6)}m</strong>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-slate-400 block font-sans">15 min</span>
                    <strong className="text-slate-800 font-black">{Math.round((selectedZone.prediction_30min?.queue_m || 1500) * 0.85)}m</strong>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-slate-400 block font-sans">30 min</span>
                    <strong className="text-rose-600 font-black">{selectedZone.prediction_30min?.queue_m || 1500}m</strong>
                  </div>
                </div>
              </div>

              {/* Recommendation Action Card */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> AI Decision Recommendation:
                </p>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {selectedZone.recommendation?.action || selectedZone.recommended_action || 'Synchronize Hosur Highway Waves & extend Silk Board phase timing by 45s'}
                </p>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Delay Reduction: <strong className="text-emerald-400">-{selectedZone.recommendation?.expected_delay_reduction_percent || 44}%</strong></span>
                  <span>Confidence: <strong className="text-blue-400">{Math.round((selectedZone.recommendation?.confidence || 0.94) * 100)}%</strong></span>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

