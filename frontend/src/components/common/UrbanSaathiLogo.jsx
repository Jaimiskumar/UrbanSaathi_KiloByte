import React from 'react';

/**
 * UrbanSaathi Brand Logo Component
 * A modern, distinct vector brand mark featuring smart highways,
 * real-time traffic signal nodes (Green/Amber/Red), and V2X wireless radar waves.
 */
export default function UrbanSaathiLogo({ 
  size = 'md', 
  showText = false, 
  variant = 'light',
  subtitle = 'Smart Traffic, V2V Autonomous Safety & AI City Infrastructure',
  className = '' 
}) {
  const sizeMap = {
    sm: { box: 'w-8 h-8', text: 'text-sm', subtext: 'text-[9px]' },
    md: { box: 'w-10 h-10', text: 'text-base sm:text-lg', subtext: 'text-xs' },
    lg: { box: 'w-12 h-12', text: 'text-xl sm:text-2xl', subtext: 'text-sm' },
    xl: { box: 'w-16 h-16', text: 'text-2xl sm:text-3xl', subtext: 'text-base' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Distinct Vector Brand Mark (No generic UF text) */}
      <div 
        className={`${currentSize.box} rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 p-1.5 shadow-md shadow-indigo-900/25 ring-1 ring-white/20 flex items-center justify-center relative overflow-hidden flex-shrink-0 group`}
      >
        {/* Subtle Ambient Cyber Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-emerald-400 opacity-25 blur-sm group-hover:opacity-40 transition-opacity"></div>
        
        <svg 
          viewBox="0 0 40 40" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-full h-full relative z-10"
        >
          <defs>
            <linearGradient id="usRoadGrad" x1="8" y1="36" x2="20" y2="14" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#6366F1" />
            </linearGradient>
            <linearGradient id="usPulseGrad" x1="14" y1="6" x2="26" y2="6" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34D399" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          {/* V2X Smart Radar Arcs */}
          <path d="M12 9C16.8 5.5 23.2 5.5 28 9" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
          <path d="M15 12C18 9.5 22 9.5 25 12" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />

          {/* Highway Perspectives (Intersecting Smart Corridors) */}
          <path d="M9 35L18.5 16H21.5L31 35" stroke="url(#usRoadGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Road Lane Divider Dashes */}
          <path d="M20 20V24" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
          <path d="M20 28V33" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />

          {/* Central Green Active Traffic Node */}
          <circle cx="20" cy="14" r="3.2" fill="#10B981" />
          <circle cx="20" cy="14" r="4.4" stroke="#34D399" strokeWidth="1" opacity="0.75" />

          {/* Red & Amber Flanking Traffic Sentinel Indicators */}
          <circle cx="11.5" cy="17" r="2" fill="#EF4444" opacity="0.9" />
          <circle cx="28.5" cy="17" r="2" fill="#F59E0B" opacity="0.9" />
        </svg>
      </div>

      {showText && (
        <div>
          <h1 className={`${currentSize.text} font-black ${variant === 'dark' ? 'text-white' : 'text-gray-900'} tracking-tight leading-none`}>
            UrbanSaathi
          </h1>
          {subtitle && (
            <p className={`${currentSize.subtext} ${variant === 'dark' ? 'text-slate-400' : 'text-gray-500'} font-mono mt-1`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
