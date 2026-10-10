import React from 'react';

/**
 * TrafficAmbientBackground
 * Purely decorative, light-mode-first ambient background with traffic & smart city motifs:
 * - Receding perspective road/lane markings
 * - Floating subtle traffic light silhouettes
 * - Radar tracking arcs / pedestrian & vehicle trace lines
 * - Pulsing camera node network
 *
 * Fully non-interactive (pointer-events: none), fixed z-0, low opacity (4-7%).
 * Respects prefers-reduced-motion automatically via CSS.
 */
export default function TrafficAmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none opacity-40 sm:opacity-55"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="roadFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#64748B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.32" />
          </linearGradient>

          <linearGradient id="radarSweep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
          </linearGradient>

          <linearGradient id="nodeLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
          </linearGradient>

          <pattern id="cityGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#CBD5E1" strokeWidth="0.75" strokeOpacity="0.35" />
          </pattern>
        </defs>

        {/* 1. Subtle Faint City Grid */}
        <rect width="100%" height="100%" fill="url(#cityGrid)" opacity="0.4" />

        {/* 2. Abstract Perspective Road Lines */}
        <g stroke="url(#roadFade)" strokeWidth="1.5">
          <line x1="720" y1="180" x2="180" y2="900" strokeDasharray="16 12" />
          <line x1="720" y1="180" x2="540" y2="900" strokeDasharray="24 16" />
          <line x1="720" y1="180" x2="900" y2="900" strokeDasharray="24 16" />
          <line x1="720" y1="180" x2="1260" y2="900" strokeDasharray="16 12" />
          {/* Horizon arc */}
          <ellipse cx="720" cy="180" rx="420" ry="14" stroke="#94A3B8" strokeOpacity="0.18" fill="none" />
        </g>

        {/* 3. Floating Radar Trace Arcs (Pedestrian/Vehicle Trajectory sweeps) */}
        <g stroke="url(#radarSweep)" fill="none">
          <circle cx="1180" cy="220" r="140" strokeWidth="1" strokeDasharray="6 8" />
          <circle cx="1180" cy="220" r="90" strokeWidth="1.2" strokeDasharray="12 12" />
          <circle cx="260" cy="620" r="180" strokeWidth="1" strokeDasharray="8 10" />
          <circle cx="260" cy="620" r="110" strokeWidth="1.2" strokeDasharray="14 8" />
        </g>

        {/* 4. Floating Traffic Light Silhouettes (Thin pastel outline, slow drift) */}
        <g transform="translate(1320, 120)" opacity="0.35">
          <rect x="0" y="0" width="28" height="74" rx="14" stroke="#64748B" strokeWidth="1.2" fill="#F1F5F9" />
          <circle cx="14" cy="16" r="6" fill="#EF4444" fillOpacity="0.35" stroke="#DC2626" strokeWidth="0.8" />
          <circle cx="14" cy="37" r="6" fill="#F59E0B" fillOpacity="0.3" stroke="#D97706" strokeWidth="0.8" />
          <circle cx="14" cy="58" r="6" fill="#10B981" fillOpacity="0.45" stroke="#059669" strokeWidth="0.8" />
        </g>

        <g transform="translate(80, 240)" opacity="0.28">
          <rect x="0" y="0" width="22" height="60" rx="11" stroke="#64748B" strokeWidth="1" fill="#F8FAFC" />
          <circle cx="11" cy="13" r="4.5" fill="#EF4444" fillOpacity="0.3" />
          <circle cx="11" cy="30" r="4.5" fill="#F59E0B" fillOpacity="0.35" />
          <circle cx="11" cy="47" r="4.5" fill="#10B981" fillOpacity="0.4" />
        </g>

        {/* 5. Camera Node Clusters connected with pulse lines */}
        <g stroke="url(#nodeLine)" strokeWidth="1.2" fill="none">
          <path d="M 880 140 L 980 190 L 1080 150 L 1180 220 L 1260 310" />
          <path d="M 220 540 L 310 480 L 420 520 L 480 610" />
        </g>

        {/* Nodes with soft colored halos */}
        <g>
          {/* Node 1 */}
          <circle cx="980" cy="190" r="4" fill="#3B82F6" fillOpacity="0.8" />
          <circle cx="980" cy="190" r="10" stroke="#3B82F6" strokeWidth="0.75" strokeOpacity="0.4" fill="none" />

          {/* Node 2 (Alert/Caution Node) */}
          <circle cx="1080" cy="150" r="3.5" fill="#F59E0B" fillOpacity="0.75" />
          <circle cx="1080" cy="150" r="8" stroke="#F59E0B" strokeWidth="0.75" strokeOpacity="0.3" fill="none" />

          {/* Node 3 (Live Sensor) */}
          <circle cx="1180" cy="220" r="4.5" fill="#10B981" fillOpacity="0.85" />
          <circle cx="1180" cy="220" r="12" stroke="#10B981" strokeWidth="0.75" strokeOpacity="0.45" fill="none" />

          {/* Node 4 */}
          <circle cx="310" cy="480" r="4" fill="#6366F1" fillOpacity="0.7" />
          <circle cx="420" cy="520" r="3.5" fill="#3B82F6" fillOpacity="0.8" />
        </g>
      </svg>
    </div>
  );
}
