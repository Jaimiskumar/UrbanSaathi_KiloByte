import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';

export default function Analytics() {
  const [signals, setSignals] = useState([]);
  const [fines, setFines] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [signalsRes, finesRes] = await Promise.all([
        axios.get('/api/traffic/signals', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/fines', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setSignals(signalsRes.data);
      setFines(finesRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const trafficData = signals.map(s => ({
    name: s.signalId,
    vehicles: s.vehicleCount,
    congestion: s.congestionLevel === 'high' ? 3 : s.congestionLevel === 'medium' ? 2 : 1
  }));

  const fineStats = {
    total: fines.length,
    pending: fines.filter(f => f.status === 'pending').length,
    paid: fines.filter(f => f.status === 'paid').length,
    revenue: fines.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0)
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Panel */}
      <div className="bg-white/80 backdrop-blur-xl border border-white/70 shadow-glass rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-full inline-block mb-2">
              System Telemetry & Analytics
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 tracking-tight">Traffic Analytics & Insights</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Real-time corridor throughput, signal telemetry, and fine enforcement revenue</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/60 text-xs font-mono text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sync Active
          </div>
        </div>
      </div>

      {/* Metric Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 p-6 glass-card-interactive">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Active Signals</p>
              <p className="text-3xl sm:text-4xl font-display font-black text-blue-600 mt-2 tabular-nums">{signals.length}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shadow-xs">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-3">Connected IoT signal intersections</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 p-6 glass-card-interactive">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Fines Collected</p>
              <p className="text-3xl sm:text-4xl font-display font-black text-emerald-600 mt-2 tabular-nums">₹{fineStats.revenue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shadow-xs">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-3">Settled e-challan municipal revenue</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 p-6 glass-card-interactive">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Fines</p>
              <p className="text-3xl sm:text-4xl font-display font-black text-amber-600 mt-2 tabular-nums">{fineStats.pending}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-3">Awaiting citizen payment or review</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 p-6 glass-card-interactive">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Fines Issued</p>
              <p className="text-3xl sm:text-4xl font-display font-black text-indigo-600 mt-2 tabular-nums">{fineStats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-3">Total recorded traffic violations</p>
        </div>
      </div>

      {/* Chart 1: Vehicle Count by Signal */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-display font-bold text-slate-900">Vehicle Volume by Signal Intersection</h3>
            <p className="text-xs font-medium text-slate-400">Live vehicle traffic count across monitored junctions</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.65} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
              contentStyle={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderRadius: '1rem', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 600 }} />
            <Bar dataKey="vehicles" name="Vehicle Flow" fill="url(#barGradient)" radius={[8, 8, 0, 0]} isAnimationActive={true} animationDuration={1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Congestion Levels with Gradient Fill & Glowing Line */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-glass border border-white/70 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-display font-bold text-slate-900">Congestion Severity Index</h3>
            <p className="text-xs font-medium text-slate-400">Relative density score (1: Flowing, 2: Moderate, 3: Heavy)</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis ticks={[1, 2, 3]} domain={[0, 4]} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderRadius: '1rem', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px', fontWeight: 600 }} />
            <Line 
              type="monotone" 
              dataKey="congestion" 
              name="Congestion Level" 
              stroke="#dc2626" 
              strokeWidth={3} 
              dot={{ fill: '#dc2626', r: 5, strokeWidth: 2, stroke: '#ffffff' }}
              activeDot={{ r: 8, fill: '#dc2626', stroke: 'rgba(220, 38, 38, 0.3)', strokeWidth: 6 }}
              isAnimationActive={true} 
              animationDuration={1200} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
