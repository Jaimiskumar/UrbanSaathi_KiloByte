import React, { useState, useEffect } from 'react';
import { AlertTriangle, Bot, Activity, Clock, Video, Sliders, Sparkles, ExternalLink } from 'lucide-react';

export default function TrafficMonitoring() {
  // Global control mode state
  const [controlMode, setControlMode] = useState('Automatic'); // 'Automatic' | 'Manual'

  // Alerts State
  const [alerts, setAlerts] = useState([
    { id: 1, type: 'violation', title: 'Violation: Illegal U-Turn detected', location: 'Oasis Mall Area', time: 'Just now', colorHex: '#EF4444', bgClass: 'bg-red-100', textClass: 'text-[#EF4444]' },
    { id: 2, type: 'warning', title: 'Congestion Warning: Heavy backlog building', location: 'Park Shopping Complex - City Corner', time: '4 mins ago', colorHex: '#F59E0B', bgClass: 'bg-amber-100', textClass: 'text-[#F59E0B]' }
  ]);

  // States of each zone
  const [zones, setZones] = useState([
    { id: 1, name: 'Outer Ring Road (Silk Board to KR Puram)', latitude: 12.9619, longitude: 77.6501, vehicles: 942, congestion: 'HIGH', signal: 'Red', timer: 43, cam: 'CAM-ORR-001', videoUrl: '/videos/Hikvision_Traffic_Flow_Analysis_Camera_240P.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Outer+Ring+Road+Silk+Board+to+KR+Puram+Bengaluru' },
    { id: 2, name: 'Bannerghatta Road', latitude: 12.8996, longitude: 77.5970, vehicles: 726, congestion: 'MEDIUM', signal: 'Green', timer: 35, cam: 'CAM-BGR-002', videoUrl: '/videos/Vehicle Detection and Traffic Counting using AI..mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bannerghatta+Road+Bengaluru' },
    { id: 3, name: 'Whitefield Main Road', latitude: 12.9698, longitude: 77.7499, vehicles: 864, congestion: 'MEDIUM', signal: 'Yellow', timer: 18, cam: 'CAM-WFR-003', videoUrl: '/videos/video_2.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Whitefield+Main+Road+Bengaluru' },
    { id: 4, name: 'Sarjapur Road', latitude: 12.9105, longitude: 77.6784, vehicles: 1088, congestion: 'HIGH', signal: 'Red', timer: 52, cam: 'CAM-SJR-004', videoUrl: '/videos/video_3.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sarjapur+Road+Bengaluru' },
    { id: 5, name: 'Old Madras Road', latitude: 13.0027, longitude: 77.6770, vehicles: 618, congestion: 'MEDIUM', signal: 'Green', timer: 27, cam: 'CAM-OMR-005', videoUrl: '/videos/video_4.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Old+Madras+Road+Bengaluru' },
    { id: 6, name: 'Tumkur Road', latitude: 13.0281, longitude: 77.5162, vehicles: 978, congestion: 'MEDIUM', signal: 'Yellow', timer: 12, cam: 'CAM-TMR-006', videoUrl: '/videos/video_3.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Tumkur+Road+Bengaluru' },
    { id: 7, name: 'Mekhri Circle', latitude: 13.0352, longitude: 77.5891, vehicles: 544, congestion: 'LOW', signal: 'Green', timer: 46, cam: 'CAM-MKC-007', videoUrl: '/videos/video_2.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mekhri+Circle+Bengaluru' },
    { id: 8, name: 'Goraguntepalya Junction', latitude: 13.0280, longitude: 77.5402, vehicles: 1152, congestion: 'HIGH', signal: 'Red', timer: 58, cam: 'CAM-GPJ-008', videoUrl: '/videos/video_4.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Goraguntepalya+Junction+Bengaluru' },
    { id: 9, name: 'Silk Institute Metro Station Area', latitude: 12.8746, longitude: 77.5831, vehicles: 438, congestion: 'LOW', signal: 'Green', timer: 31, cam: 'CAM-SIM-009', videoUrl: '/videos/video_2.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Silk+Institute+Metro+Station+Bengaluru' },
    { id: 10, name: 'Sarakki Junction', latitude: 12.9077, longitude: 77.6010, vehicles: 702, congestion: 'MEDIUM', signal: 'Yellow', timer: 22, cam: 'CAM-SRK-010', videoUrl: '/videos/video_3.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sarakki+Junction+Bengaluru' },
    { id: 11, name: 'Karisandra', latitude: 12.9368, longitude: 77.5925, vehicles: 386, congestion: 'LOW', signal: 'Green', timer: 39, cam: 'CAM-KRS-011', videoUrl: '/videos/video_4.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Karisandra+Bengaluru' },
    { id: 12, name: 'Kadubeesanahalli', latitude: 12.9352, longitude: 77.6960, vehicles: 1004, congestion: 'HIGH', signal: 'Red', timer: 16, cam: 'CAM-KDB-012', videoUrl: '/videos/Hikvision_Traffic_Flow_Analysis_Camera_240P.mp4', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Kadubeesanahalli+Bengaluru' }
  ]);

  // Selected zone to display in the main monitor
  const [selectedZoneId, setSelectedZoneId] = useState(1);
  const activeZone = zones.find(z => z.id === selectedZoneId);

  // Handle automatic timer and vehicle count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setZones(prevZones => prevZones.map(zone => {
        let newTimer = zone.timer;
        let newSignal = zone.signal;
        
        // Time logic in Automatic mode
        if (controlMode === 'Automatic') {
          newTimer -= 1;
          if (newTimer <= 0) {
            if (newSignal === 'Green') { newSignal = 'Yellow'; newTimer = 5; }
            else if (newSignal === 'Yellow') { newSignal = 'Red'; newTimer = Math.floor(Math.random() * 30) + 30; } // 30-60s
            else if (newSignal === 'Red') { newSignal = 'Green'; newTimer = Math.floor(Math.random() * 30) + 30; }
          }
        } else {
          // In Manual mode, maybe the timer stays frozen or counts up to show how long it has been in this state.
          // Let's just keep it at 0 or simply not count down if manually controlled.
        }
        
        // Randomly adjust vehicles for dynamics
        // Fluctuate between -8 to +8
        const vehicleChange = Math.floor(Math.random() * 17) - 8;
        let newVehicles = Math.max(0, zone.vehicles + vehicleChange);
        
        // Adjust congestion based on vehicle count
        let newCongestion = 'LOW';
        if (newVehicles > 1000) newCongestion = 'HIGH';
        else if (newVehicles > 600) newCongestion = 'MEDIUM';
        
        return { ...zone, timer: newTimer, signal: newSignal, vehicles: newVehicles, congestion: newCongestion };
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [controlMode]);

  const handleManualSignalChange = (color) => {
    if (controlMode !== 'Manual') return;
    setZones(prevZones => prevZones.map(zone => {
       if (zone.id === selectedZoneId) {
          // When manually changing, set it and reset a dummy timer
          return { ...zone, signal: color, timer: 0 };
       }
       return zone;
    }));
  };

  const getCongestionColor = (level) => {
    if (level === 'HIGH') return 'text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]/40';
    if (level === 'MEDIUM') return 'text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/40';
    return 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/40';
  };

  const getSignalColorClass = (currentSignal, targetColor) => {
    const active = currentSignal === targetColor;
    if (targetColor === 'Red') return active ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-red-900/50';
    if (targetColor === 'Yellow') return active ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'bg-yellow-900/50';
    if (targetColor === 'Green') return active ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]' : 'bg-green-900/50';
  };

  const openZoneInMaps = (zone) => {
    window.open(zone.mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleZoneCardClick = (zone) => {
    setSelectedZoneId(zone.id);
  };

  const handleZoneMapClick = (event, zone) => {
    event.stopPropagation();
    openZoneInMaps(zone);
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 lg:p-6 font-sans text-slate-900">
      
      {/* Alert Strip - Liquid Glass with Saturated Semantic Accents */}
      <div className="flex flex-col gap-3 mb-6 relative z-10">
        {alerts.map(alert => (
          <div 
            key={alert.id} 
            className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-glass border border-white/80 border-l-4 transition-all hover:shadow-glass-hover" 
            style={{ borderLeftColor: alert.colorHex }}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${alert.bgClass} ring-1 ring-black/5`}>
                {alert.type === 'violation' ? (
                  <AlertTriangle className={`w-4 h-4 ${alert.textClass}`} />
                ) : (
                  <Activity className={`w-4 h-4 ${alert.textClass}`} />
                )}
              </div>
              <div>
                <p className="font-display font-bold text-sm text-slate-900 leading-tight">{alert.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100/90 border border-slate-200/60 px-2 py-0.5 rounded-md">{alert.location}</span>
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {alert.time}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} 
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              aria-label="Dismiss alert"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        ))}
      </div>

      {/* Active Emergencies Box - Liquid Alert Glass */}
      <div className="bg-red-50/80 backdrop-blur-xl border border-red-200/80 border-l-4 border-l-red-600 p-4 rounded-2xl shadow-alert-red mb-6 flex items-center justify-between transition-all">
        <div className="flex items-center">
          <div className="relative flex h-8 w-8 items-center justify-center mr-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <div className="w-8 h-8 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 relative">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-display font-black text-red-900 tracking-tight">Active Emergency Corridor Ready</h3>
            <p className="text-xs font-semibold text-red-700/90 mt-0.5">SITA AI Engine calibrated for priority Green Corridor preemption</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-xs text-red-700 text-xs font-black tracking-wider border border-red-200 uppercase">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          Preemption Active
        </div>
      </div>

      {/* 2-Column Bento Layout */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        
        {/* Left Column - Hero CCTV Video Bento Tile */}
        <div className="lg:w-[52%] xl:w-[60%] flex flex-col">
          <div className="bg-slate-900 rounded-3xl shadow-2xl h-full min-h-[420px] flex items-center justify-center relative overflow-hidden group border border-slate-700/80">
            {/* The Video Element */}
            <video 
               key={activeZone?.videoUrl || activeZone?.id}
               src={activeZone?.videoUrl || "/videos/Hikvision_Traffic_Flow_Analysis_Camera_240P.mp4"} 
               autoPlay 
               loop 
               muted 
               className="object-cover w-full h-full absolute inset-0 z-0"
               onError={(e) => {
                 e.target.style.display = 'none';
               }}
            />
            {/* Ambient Dark Gradient Vignette for crisp text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/50 z-0 pointer-events-none"></div>

            {/* Top Left Zone Name Pill */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl px-3.5 py-1.5 rounded-xl border border-white/15 shadow-xl">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-white text-xs sm:text-sm font-display font-bold tracking-wide">{activeZone?.name}</span>
            </div>

            {/* Agent Insight Overlay */}
            <div className="absolute top-16 left-4 z-10 max-w-[240px] pointer-events-none">
              <div className="bg-blue-600/90 backdrop-blur-xl px-3 py-2 rounded-xl shadow-2xl border border-blue-400/40 animate-in fade-in slide-in-from-left duration-500">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot className="w-3.5 h-3.5 text-white" />
                  <span className="text-[10px] font-black text-white tracking-widest uppercase">Autonomous Insight</span>
                </div>
                <p className="text-[11px] text-blue-50 font-medium leading-snug">
                  {activeZone?.congestion === 'HIGH' 
                    ? "SITA is dynamically extending Green phase by 15s to relieve backlog." 
                    : "Optimal balance sustained across pedestrian and cross-junction traffic."}
                </p>
              </div>
            </div>

            {/* Top Right Live Clock Pill */}
            <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/15 shadow-xl font-mono text-xs text-slate-200">
              {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </div>

            {/* Bottom Left Camera Tag */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2.5">
               <span className="font-mono text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-lg shadow-lg border border-blue-400/40 flex items-center gap-1.5">
                 <Video className="w-3 h-3 text-white" />
                 {activeZone?.cam}
               </span>
               <span className="font-mono text-[11px] text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-white/10">30 FPS • HD</span>
            </div>
            
            {/* Bottom Right Signal Countdown Overlay */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-950/70 backdrop-blur-md px-2.5 py-0.5 rounded-md border border-white/10">Signal Phase Countdown</span>
               <div className={`font-mono text-3xl sm:text-4xl font-black bg-slate-950/90 px-4 py-2 rounded-2xl border-2 shadow-2xl backdrop-blur-xl flex items-center gap-3 ${
                 activeZone?.signal === 'Red' ? 'text-red-400 border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.45)]' :
                 activeZone?.signal === 'Yellow' ? 'text-amber-300 border-amber-400/70 shadow-[0_0_25px_rgba(245,158,11,0.45)]' :
                 'text-emerald-400 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.45)]'
               }`}>
                 <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${
                    activeZone?.signal === 'Red' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]' :
                    activeZone?.signal === 'Yellow' ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]'
                 }`}></div>
                 0:{activeZone?.timer < 10 ? `0${Math.max(0, activeZone.timer)}` : Math.max(0, activeZone.timer)}
               </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stat Bento Cards & Controls */}
        <div className="lg:w-[48%] xl:w-[40%] flex flex-col justify-between gap-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card: Vehicle Count */}
            <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-glass border border-white/70 glass-card-interactive flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Live Flow Rate</p>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-black text-slate-900 mt-2 tabular-nums">
                {activeZone?.vehicles} <span className="text-sm font-semibold text-slate-400 font-sans">vehicles</span>
              </h2>
              <p className="text-[11px] font-medium text-slate-500 mt-1">Real-time corridor volume</p>
            </div>

            {/* Card: Congestion */}
            <div className="bg-white/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-glass border border-white/70 glass-card-interactive flex flex-col justify-center">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Saturation Level</p>
              <div className="mt-2 text-left">
                <span className={`px-3.5 py-1.5 rounded-xl font-black tracking-wider text-xs uppercase border inline-flex items-center gap-1.5 ${getCongestionColor(activeZone?.congestion)}`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {activeZone?.congestion}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-2">Corridor capacity status</p>
            </div>
          </div>

          {/* Adaptive Signal Control Panel */}
          <div className="bg-white/85 backdrop-blur-2xl p-5 sm:p-6 rounded-3xl shadow-glass border border-white/80 flex flex-col flex-1">
             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5">
               <div>
                 <h3 className="text-base sm:text-lg font-display font-black text-slate-900 tracking-tight flex items-center gap-2">
                   <Sliders className="w-4 h-4 text-blue-600" />
                   Adaptive Signal Matrix
                 </h3>
                 <p className="text-xs font-medium text-slate-400">Autonomous timing & operator manual override</p>
               </div>
               
               {/* Toggle Switch - Frosted Glass Pill */}
               <div className="bg-slate-100/90 backdrop-blur-sm p-1 rounded-xl flex items-center border border-slate-200/60 self-start sm:self-auto shadow-xs">
                 <button 
                  onClick={() => setControlMode('Automatic')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${controlMode === 'Automatic' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   Auto AI
                 </button>
                 <button 
                  onClick={() => setControlMode('Manual')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${controlMode === 'Manual' ? 'bg-white shadow-xs text-amber-600' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   Manual
                 </button>
               </div>
             </div>
             
             <div className="flex items-center gap-6 mt-1 pb-1">
                {/* Traffic Light UI - High-Tech Module */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 inline-flex flex-col gap-3 shadow-xl ring-1 ring-slate-800">
                   {/* Red */}
                   <button 
                     onClick={() => handleManualSignalChange('Red')}
                     disabled={controlMode === 'Automatic'}
                     aria-label="Set Signal Red"
                     className={`w-9 h-9 rounded-full transition-all duration-300 border border-black/40 ${getSignalColorClass(activeZone?.signal, 'Red')} ${controlMode === 'Manual' && activeZone?.signal !== 'Red' ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
                   ></button>
                   {/* Yellow */}
                   <button 
                     onClick={() => handleManualSignalChange('Yellow')}
                     disabled={controlMode === 'Automatic'}
                     aria-label="Set Signal Yellow"
                     className={`w-9 h-9 rounded-full transition-all duration-300 border border-black/40 ${getSignalColorClass(activeZone?.signal, 'Yellow')} ${controlMode === 'Manual' && activeZone?.signal !== 'Yellow' ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
                   ></button>
                   {/* Green */}
                   <button 
                     onClick={() => handleManualSignalChange('Green')}
                     disabled={controlMode === 'Automatic'}
                     aria-label="Set Signal Green"
                     className={`w-9 h-9 rounded-full transition-all duration-300 border border-black/40 ${getSignalColorClass(activeZone?.signal, 'Green')} ${controlMode === 'Manual' && activeZone?.signal !== 'Green' ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
                   ></button>
                </div>
                
                {/* Signal Info */}
                <div className="flex-1 flex flex-col justify-center">
                   <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Current Active Timer</p>
                   {controlMode === 'Automatic' ? (
                     <div className="flex items-baseline gap-2">
                       <h2 className="text-4xl sm:text-5xl font-mono font-black text-slate-900 tabular-nums leading-none">
                         0:{activeZone?.timer < 10 ? `0${Math.max(0, activeZone.timer)}` : Math.max(0, activeZone.timer)}
                       </h2>
                       <span className="text-slate-400 font-semibold text-xs">sec remaining</span>
                     </div>
                   ) : (
                     <div className="text-xl font-bold text-amber-600 font-display">Manual Hold Engaged</div>
                   )}
                   
                   <div className="mt-4 flex flex-col gap-2">
                      <div className={`px-3 py-1.5 rounded-xl inline-flex items-center text-xs font-bold border max-w-max ${
                        controlMode === 'Automatic' 
                          ? 'bg-blue-50/90 text-blue-700 border-blue-200 shadow-xs' 
                          : 'bg-amber-50/90 text-amber-700 border-amber-200 shadow-xs'
                      }`}>
                        {controlMode === 'Automatic' ? (
                           <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-blue-600" /> SITA Neural Signal Optimizer Active</span>
                        ) : (
                           <span className="flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-amber-600" /> Manual Operator Control Engaged</span>
                        )}
                      </div>
                      {controlMode === 'Manual' && (
                        <p className="text-[11px] font-medium text-slate-500">Tap individual signal lamps above to trigger immediate phase transitions.</p>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>

      </div>

      {/* Bottom Horizontal Row of Zone Bento Cards */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-display font-bold text-slate-700 uppercase tracking-wider">Bengaluru Grid Corridors ({zones.length})</h3>
        <span className="text-xs text-slate-400 font-medium">Click any corridor to switch live feed</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {zones.map((zone) => {
          const isSelected = selectedZoneId === zone.id;
          return (
            <div 
              key={zone.id} 
              onClick={() => handleZoneCardClick(zone)}
              className={`p-5 rounded-2xl shadow-glass border flex flex-col justify-between cursor-pointer transition-all duration-200 glass-card-interactive ${
                isSelected 
                  ? 'bg-white/95 ring-2 ring-blue-600 border-transparent shadow-glass-hover' 
                  : 'bg-white/75 backdrop-blur-xl border-white/80 hover:bg-white/90'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                 <div>
                   <h4 className="font-display font-bold text-slate-900 text-sm leading-snug">{zone.name}</h4>
                   <p className="text-[10px] font-mono font-medium text-slate-400 mt-0.5">ID: {zone.cam}</p>
                 </div>
                 <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider border uppercase ${getCongestionColor(zone.congestion)}`}>
                   {zone.congestion}
                 </span>
              </div>
              <div className="flex justify-between items-end">
                 <div className="flex flex-col">
                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Density</span>
                   <span className="text-2xl font-display font-black text-slate-900 tabular-nums mt-0.5">{zone.vehicles}</span>
                   <button
                     type="button"
                     onClick={(event) => handleZoneMapClick(event, zone)}
                     className="text-[11px] text-blue-600 font-semibold mt-2 inline-flex items-center gap-1 hover:text-blue-700 hover:underline cursor-pointer"
                   >
                     <span>Map</span>
                     <ExternalLink className="w-3 h-3" />
                   </button>
                 </div>
                 
                 {/* Live Signal Indicator Pill */}
                 <div className="flex flex-col items-center gap-1.5 bg-slate-100/90 border border-slate-200/60 p-2 rounded-xl shadow-xs">
                    <div className={`w-2.5 h-2.5 rounded-full ${zone.signal === 'Red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]' : 'bg-red-900/30'}`}></div>
                    <div className={`w-2.5 h-2.5 rounded-full ${zone.signal === 'Yellow' ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)]' : 'bg-amber-900/30'}`}></div>
                    <div className={`w-2.5 h-2.5 rounded-full ${zone.signal === 'Green' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]' : 'bg-emerald-900/30'}`}></div>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
