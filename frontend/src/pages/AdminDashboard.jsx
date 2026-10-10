import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Car, ParkingCircle, AlertTriangle, Activity, LogOut, Truck, Menu, X, Camera, Ban, Zap, Radio, Shield, Construction, Bot, FileBarChart, Map as MapIcon, Sparkles } from 'lucide-react';
import TrafficMonitoring from '../components/admin/TrafficMonitoring';
import ParkingManagement from '../components/admin/ParkingManagement';
import ViolationManagement from '../components/admin/ViolationManagement';
import EmergencyControl from '../components/admin/EmergencyControl';
import Analytics from '../components/admin/Analytics';
import EncroachmentMonitoring from '../components/admin/EncroachmentMonitoring';
import IllegalParkingDetection from '../components/admin/IllegalParkingDetection';
import AIAgentCenter from '../components/admin/AIAgentCenter';
import MLDetectionUpload from '../components/admin/MLDetectionUpload';
import DailyReports from '../components/admin/DailyReports';
import BangaloreTrafficMap from '../components/admin/BangaloreTrafficMap';
import V2VSafetyCenter from '../components/admin/V2VSafetyCenter';
import RoadIntelligence from '../components/admin/RoadIntelligence';
import TrafficAmbientBackground from '../components/common/TrafficAmbientBackground';

export default function AdminDashboard({ user, onLogout }) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('v2v-safety');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const path = location.pathname.split('/').pop();
    if (path && path !== 'admin') setActiveTab(path);
  }, [location]);

  const tabs = [
    { id: 'v2v-safety', label: 'Connected Vehicle & Safety', icon: Radio, path: '/admin/v2v-safety', color: 'blue' },
    { id: 'bangalore-map', label: 'Bangalore Traffic Map', icon: MapIcon, path: '/admin/bangalore-map', color: 'blue' },
    { id: 'agents', label: 'AI Agent Center', icon: Bot, path: '/admin/agents', color: 'indigo' },
    { id: 'traffic', label: 'Traffic Monitoring', icon: Car, path: '/admin/traffic', color: 'blue' },
    { id: 'parking', label: 'Parking Management', icon: ParkingCircle, path: '/admin/parking', color: 'green' },
    { id: 'violations', label: 'Violations', icon: AlertTriangle, path: '/admin/violations', color: 'orange' },
    { id: 'ml-detection', label: 'ML Detection', icon: Zap, path: '/admin/ml-detection', color: 'cyan' },
    { id: 'illegal-parking', label: 'Illegal Parking AI', icon: Ban, path: '/admin/illegal-parking', color: 'rose' },
    { id: 'encroachment', label: 'Encroachment Monitor', icon: Camera, path: '/admin/encroachment', color: 'indigo' },
    { id: 'emergency', label: 'Emergency', icon: Truck, path: '/admin/emergency', color: 'red' },
    { id: 'analytics', label: 'Analytics', icon: Activity, path: '/admin/analytics', color: 'purple' },
    { id: 'reports', label: 'Daily Reports', icon: FileBarChart, path: '/admin/reports', color: 'emerald' },
    { id: 'road-intelligence', label: 'Road Intelligence', icon: Construction, path: '/admin/road-intelligence', color: 'blue' }
  ];

  return (
    <div className="flex h-screen bg-slate-100/50 overflow-hidden relative font-sans text-slate-900">
      {/* Domain-specific Ambient Background Layer */}
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
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 ring-1 ring-white/60">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-display font-extrabold text-slate-900 tracking-tight">
                UrbanSaathi
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase">Vision & Traffic Control</p>
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

              {/* Status indicator pill */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Live Control Room</span>
                <span className="text-slate-300">|</span>
                <span className="text-[11px] font-mono font-medium text-slate-500">Bengaluru Grid Active</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link
                to="/mobile"
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/80 text-indigo-700 rounded-xl text-xs font-bold hover:shadow-xs hover:border-indigo-300 transition-all active:scale-95"
              >
                <Radio className="w-3.5 h-3.5 text-indigo-600" />
                Mobile OBU / Edge
              </Link>

              <div className="flex items-center space-x-2.5 px-3 py-1.5 bg-white/80 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{user?.name || 'Admin Operator'}</p>
                  <p className="text-[10px] font-medium text-slate-400 leading-tight">Master Controller</p>
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
              <Route path="/" element={<V2VSafetyCenter />} />
              <Route path="/v2v-safety" element={<V2VSafetyCenter />} />
              <Route path="/connected-vehicle" element={<V2VSafetyCenter />} />
              <Route path="/bangalore-map" element={<BangaloreTrafficMap />} />
              <Route path="/traffic" element={<TrafficMonitoring />} />
              <Route path="/parking" element={<ParkingManagement />} />
              <Route path="/violations" element={<ViolationManagement />} />
              <Route path="/ml-detection" element={<MLDetectionUpload />} />
              <Route path="/illegal-parking" element={<IllegalParkingDetection />} />
              <Route path="/encroachment" element={<EncroachmentMonitoring />} />
              <Route path="/emergency" element={<EmergencyControl />} />
              <Route path="/agents" element={<AIAgentCenter />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<DailyReports />} />
              <Route path="road-intelligence" element={<RoadIntelligence />} />
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
