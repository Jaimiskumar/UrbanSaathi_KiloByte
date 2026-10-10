import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MobileFieldApp from '../components/mobile/MobileFieldApp';
import { Monitor, Smartphone, ArrowLeft } from 'lucide-react';

export default function MobileAppPage() {
  const [deviceFrame, setDeviceFrame] = useState(true);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    // Detect if running directly on a mobile screen / phone
    const checkMobile = () => {
      const isTouchOrSmall = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobileDevice(isTouchOrSmall);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // If on actual mobile phone / iPhone, render 100% pure full-screen app
  if (isMobileDevice) {
    return (
      <div className="w-full min-h-screen bg-slate-50 overflow-x-hidden flex flex-col justify-start">
        <MobileFieldApp />
      </div>
    );
  }

  // If on Desktop browser, provide interactive device frame & preview switcher
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 text-gray-800">
      
      {/* Top Bar for Desktop Viewers */}
      <div className="w-full max-w-4xl mb-4 flex items-center justify-between bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-blue-600 transition-all bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Web Dashboard
          </Link>
          <span className="text-xs font-mono text-gray-400">|</span>
          <span className="text-xs font-bold text-gray-900">📱 Mobile Field & Citizen Application View</span>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <button
            onClick={() => setDeviceFrame(!deviceFrame)}
            className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            {deviceFrame ? 'Device Frame: ON' : 'Device Frame: OFF'}
          </button>
          
          <Link
            to="/citizen"
            className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all"
          >
            <Monitor className="w-4 h-4" />
            Citizen Web Portal
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div className={deviceFrame ? "w-full max-w-md bg-white rounded-[40px] shadow-2xl border-[8px] border-slate-900 overflow-hidden min-h-[840px] max-h-[90vh] flex flex-col justify-start relative" : "w-full max-w-md bg-white shadow-lg min-h-[840px] flex flex-col justify-start"}>
        <MobileFieldApp />
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-center text-xs text-gray-500 font-mono">
        UrbanSathi Smart City Mobile Client • Pure Mobile Engine
      </div>

    </div>
  );
}
