import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ParkingBooking from '../components/citizen/ParkingBooking';
import MyBookings from '../components/citizen/MyBookings';
import MyFines from '../components/citizen/MyFines';
import ReportViolation from '../components/citizen/ReportViolation';
import ReportRoadIssue from '../components/citizen/ReportRoadIssue';
import RoadNews from '../components/citizen/RoadNews';
import TrafficMap from '../components/citizen/TrafficMap';
import SmartCityShield from '../components/citizen/SmartCityShield';
import { 
  ParkingCircle, 
  CreditCard, 
  AlertCircle, 
  LogOut, 
  User, 
  Menu, 
  X, 
  Camera,
  Construction,
  Megaphone,
  Sparkles,
  Shield,
  Map as MapIcon
} from 'lucide-react';

import TrafficAmbientBackground from '../components/common/TrafficAmbientBackground';

export default function CitizenDashboard({ user, onLogout }) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('smart-city');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const path = location.pathname.split('/').pop();
    if (path && path !== 'citizen') setActiveTab(path);
  }, [location]);

  const tabs = [
    { id: 'smart-city', label: 'Smart City & Pedestrian Shield', icon: Sparkles, path: '/citizen/smart-city', color: 'emerald' },
    { id: 'parking', label: 'Book Parking', icon: ParkingCircle, path: '/citizen/parking', color: 'blue' },
    { id: 'map', label: 'Live Traffic Map', icon: MapIcon, path: '/citizen/map' },
    { id: 'bookings', label: 'My Bookings', icon: User, path: '/citizen/bookings' },
    { id: 'fines', label: 'My Fines', icon: AlertCircle, path: '/citizen/fines' },
    { id: 'report', label: 'Report Violation', icon: Camera, path: '/citizen/report' },
    { id: 'road-issue', label: 'Report Road Issue', icon: Construction, path: '/citizen/road-issue' },
    { id: 'news', label: 'Road News', icon: Megaphone, path: '/citizen/news' }
  ];

  return (
    <div className="flex h-screen bg-slate-100/50 overflow-hidden relative font-sans text-slate-900">
      {/* Domain Ambient Background */}
      <TrafficAmbientBackground />

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Liquid Frosted Glass */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/80 backdrop-blur-2xl border-r border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transform transition-transform duration-300 ease-in-out flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between h-16 bg-white/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-white/60">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-display font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                UrbanSaathi
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">Citizen</span>
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase">Bengaluru Smart City Portal</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-500/50' 
                    : 'text-slate-600 hover:bg-white/90 hover:text-slate-900 hover:shadow-sm'
                }`}
              >
                {isActive && (
                  <span className="absolute left-1 w-1 h-5 bg-white rounded-full shadow-sm" />
                )}
                <tab.icon className={`w-4 h-4 mr-2.5 transition-transform duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600 group-hover:scale-110'}`} />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Navbar - Frosted Liquid Glass */}
        <header className="bg-white/75 backdrop-blur-xl border-b border-slate-200/70 shadow-sm z-30">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Citizen Safety Shield Active</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link
                to="/mobile"
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 text-indigo-700 rounded-xl text-xs font-bold hover:shadow-xs hover:border-indigo-300 transition-all active:scale-95"
              >
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                Mobile OBU View
              </Link>

              <div className="flex items-center space-x-2.5 px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  {user?.name?.charAt(0) || 'C'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{user?.name || 'Citizen'}</p>
                  <p className="text-[10px] font-medium text-slate-400 leading-tight">Verified Citizen</p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center px-3.5 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-red-500/20 transition-all transform active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 relative">
          <div className="animate-fade-in max-w-7xl mx-auto pb-20 lg:pb-0">
            <Routes>
              <Route path="/" element={<SmartCityShield />} />
              <Route path="/smart-city" element={<SmartCityShield />} />
              <Route path="/parking" element={<ParkingBooking user={user} />} />
              <Route path="/map" element={<TrafficMap />} />
              <Route path="/bookings" element={<MyBookings />} />
              <Route path="/fines" element={<MyFines />} />
              <Route path="/report" element={<ReportViolation />} />
              <Route path="/road-issue" element={<ReportRoadIssue />} />
              <Route path="/news" element={<RoadNews />} />
            </Routes>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
