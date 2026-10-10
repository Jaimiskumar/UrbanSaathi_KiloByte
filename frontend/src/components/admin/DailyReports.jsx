import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, 
  Download, 
  Calendar, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  MapPin, 
  IndianRupee,
  Clock,
  Filter,
  Activity,
  ParkingCircle,
  LayoutGrid,
  ShieldAlert,
  Construction,
  Car
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DailyReports() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('overview');

  useEffect(() => {
    fetchStats();
  }, [date]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/admin-reports/daily-stats?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (type = 'All') => {
    if (!data) return;

    let headers = ['Category', 'Type/ID', 'Amount', 'Status', 'Location'];
    let rows = [];

    if (type === 'All' || type === 'Challans') {
      data.details.fines.forEach(f => rows.push(['E-Challan', f.id, f.amount, f.status, f.location || 'Bengaluru']));
    }
    if (type === 'All' || type === 'Parking') {
      data.details.bookings.forEach(b => rows.push(['Parking', b.id, b.amount, b.status, b.spot]));
    }
    if (type === 'All' || type === 'Issues') {
      data.details.roadIssues.forEach(i => rows.push(['Citizen Report', i.id, '-', i.status, i.location]));
    }
    if (type === 'All' || type === 'Violations') {
      data.details.illegalParkings.forEach(p => rows.push(['Illegal Parking', p.id, '-', 'Detected', p.location]));
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bengaluru_SmartHorizon_${type}_Report_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${type} report downloaded`);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid, color: 'blue' },
    { id: 'challans', label: 'E-Challans', icon: FileText, color: 'blue' },
    { id: 'parking', label: 'Parking Revenue', icon: ParkingCircle, color: 'emerald' },
    { id: 'violations', label: 'Illegal Parkings', icon: ShieldAlert, color: 'orange' },
    { id: 'issues', label: 'Road Issues', icon: Construction, color: 'purple' }
  ];

  if (loading && !data) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-20 font-sans">
      
      {/* Header Section - Liquid Glass */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-glass border border-white/70">
        <div>
          <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-full inline-block mb-2">
            Audit & Municipal Intelligence
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 tracking-tight">Municipal <span className="text-blue-600">Intelligence</span></h2>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">Historical and real-time municipal aggregation & telemetry portal</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-11 pr-5 py-2.5 bg-white/90 border border-slate-200/80 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none shadow-xs"
            />
          </div>
          <button 
            onClick={() => downloadCSV('All')}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/15 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Master CSV</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation - Frosted Glass Bar */}
      <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl p-2 rounded-2xl shadow-glass border border-white/80 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shrink-0 ${
              activeSubTab === tab.id 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/80'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[
              { label: 'Total Revenue', value: `₹${data?.stats.totalRevenue.toLocaleString() || 0}`, icon: IndianRupee, color: 'emerald', detail: `${data?.stats.finesRevenue} Fines + ${data?.stats.parkingRevenue} Parking` },
              { label: 'E-Challans', value: data?.stats.finesCount || 0, icon: FileText, color: 'blue', detail: 'Total violations issued' },
              { label: 'Illegal Parking', value: data?.stats.illegalParkingCount || 0, icon: AlertCircle, color: 'orange', detail: 'AI detection incidents' },
              { label: 'Citizen Reports', value: data?.stats.roadIssuesCount || 0, icon: Activity, color: 'purple', detail: 'Infrastructure issues filed' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/70 shadow-glass glass-card-interactive group overflow-hidden relative">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-700 shadow-xs">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="text-slate-400 font-extrabold text-[10px] uppercase tracking-widest mb-1">{stat.label}</h4>
                <p className="text-2xl sm:text-3xl font-display font-black text-slate-900 tabular-nums">{stat.value}</p>
                <p className="text-[11px] font-medium text-slate-500 mt-2">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Area Revenue Breakdown */}
            <div className="lg:col-span-1 bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-glass border border-white/70">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900 tracking-tight">Area Revenue</h3>
                  <p className="text-xs text-slate-400 font-medium">Corridor financial yields</p>
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="space-y-3">
                {data && Object.keys(data.areaStats).length > 0 ? Object.entries(data.areaStats).map(([area, stats]) => (
                  <div key={area} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between group hover:bg-white hover:shadow-xs transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-xs border border-slate-100">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">{area}</h5>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{stats.bookings} bookings</p>
                      </div>
                    </div>
                    <div className="text-right"><p className="text-xs font-bold text-emerald-600 font-mono">₹{stats.revenue.toLocaleString()}</p></div>
                  </div>
                )) : <div className="text-center py-12 text-slate-400 italic font-medium text-xs">No data for this area</div>}
              </div>
            </div>

            {/* Daily Optimization Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden text-white">
               <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none"></div>
               <div className="relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 bg-white/15 px-3 py-1 rounded-full inline-block mb-3 border border-white/20">Autonomous Engine</span>
                  <h3 className="text-2xl sm:text-3xl font-display font-extrabold mb-2 leading-tight">Smart City Grid Optimization</h3>
                  <p className="text-blue-100/90 text-xs sm:text-sm font-medium mb-8 max-w-xl">Continuous machine learning rebalancing and dynamic resource orchestration across Bengaluru's smart traffic sensors.</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15">
                        <Activity className="w-5 h-5 mb-2 text-emerald-300" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">System Uptime</p>
                        <p className="text-2xl font-mono font-black mt-1">99.98%</p>
                     </div>
                     <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15">
                        <ShieldAlert className="w-5 h-5 mb-2 text-amber-300" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Alert Latency</p>
                        <p className="text-2xl font-mono font-black mt-1">1.2s</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </>
      )}

      {/* Specific Tables */}
      {activeSubTab !== 'overview' && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <div>
               <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">{tabs.find(t => t.id === activeSubTab).label}</h3>
               <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Detailed Event Log for {date}</p>
            </div>
            <button 
              onClick={() => downloadCSV(tabs.find(t => t.id === activeSubTab).label.split(' ')[0])}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all border border-slate-200 shadow-xs"
            >
              <Download className="w-4 h-4" />
              Download Segment
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  {activeSubTab === 'challans' && ['Violation ID', 'Vehicle #', 'Amount', 'Type', 'Status'].map(h => <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>)}
                  {activeSubTab === 'parking' && ['Booking ID', 'Vehicle #', 'Zone', 'Amount', 'Status'].map(h => <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>)}
                  {activeSubTab === 'violations' && ['Detection ID', 'License Plate', 'Type', 'Location', 'Severity'].map(h => <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>)}
                  {activeSubTab === 'issues' && ['Report ID', 'Issue Type', 'Location', 'Summary', 'Status'].map(h => <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activeSubTab === 'challans' && data.details.fines.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{f.id}</td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-800">{f.vehicle || 'KA-01-XX-0000'}</td>
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">₹{f.amount}</td>
                    <td className="px-6 py-4 font-medium uppercase text-slate-500">{f.type}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider">{f.status}</span></td>
                  </tr>
                ))}
                
                {activeSubTab === 'parking' && data.details.bookings.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{b.id}</td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-800">{b.vehicle}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{b.spot}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-600">₹{b.amount}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider">{b.status}</span></td>
                  </tr>
                ))}

                {activeSubTab === 'violations' && data.details.illegalParkings.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-8 py-5 font-black text-xs">{p.id.slice(-8)}</td>
                    <td className="px-8 py-5 font-bold text-xs">{p.plate}</td>
                    <td className="px-8 py-5 font-bold text-xs text-orange-600 uppercase tracking-tighter">{p.type}</td>
                    <td className="px-8 py-5 font-bold text-xs text-slate-400">{p.location}</td>
                    <td className="px-8 py-5"><span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest">High</span></td>
                  </tr>
                ))}

                {activeSubTab === 'issues' && data.details.roadIssues.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50/50">
                    <td className="px-8 py-5 font-black text-xs">{i.id.slice(-8)}</td>
                    <td className="px-8 py-5 font-bold text-xs tracking-tight">{i.type || 'Pothole'}</td>
                    <td className="px-8 py-5 font-bold text-xs text-slate-400">{i.location}</td>
                    <td className="px-8 py-5 font-bold text-[10px] text-slate-400 max-w-xs truncate">Reported infrastructure vulnerability</td>
                    <td className="px-8 py-5"><span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black uppercase tracking-widest">{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {(activeSubTab === 'challans' && data.details.fines.length === 0) ||
             (activeSubTab === 'parking' && data.details.bookings.length === 0) ||
             (activeSubTab === 'violations' && data.details.illegalParkings.length === 0) ||
             (activeSubTab === 'issues' && data.details.roadIssues.length === 0) ? (
              <div className="py-20 text-center text-slate-200">
                <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="font-black text-sm uppercase tracking-widest">No reports found for this segment</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <style jsx="true">{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in {
           from { opacity: 0; transform: translateY(10px); }
           to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
