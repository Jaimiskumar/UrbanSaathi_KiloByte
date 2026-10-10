import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Activity, AlertTriangle, Car, MapPin, Play, ShieldCheck } from 'lucide-react';

const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
const gujaratCameras = [
  ['S.G. Highway - Thaltej', 'Ahmedabad'], ['Ashram Road - Income Tax Circle', 'Ahmedabad'], ['C.G. Road - Navrangpura', 'Ahmedabad'], ['Airport Road - Hansol', 'Ahmedabad'], ['Ring Road - Odhav Circle', 'Ahmedabad'],
  ['Infocity Circle', 'Gandhinagar'], ['Akshardham Road', 'Gandhinagar'], ['Sargasan Cross Road', 'Gandhinagar'], ['Alkapuri', 'Vadodara'], ['Sama Savli Road', 'Vadodara'],
  ['Makarpura Junction', 'Vadodara'], ['Athwa Gate', 'Surat'], ['Udhna Darwaja', 'Surat'], ['Varachha Road', 'Surat'], ['Dumas Road', 'Surat'],
  ['Kalawad Road', 'Rajkot'], ['Gondal Chowk', 'Rajkot'], ['Dhebar Road', 'Rajkot'], ['Ghogha Circle', 'Bhavnagar'], ['Bedi Road', 'Jamnagar'],
  ['Majevadi Gate', 'Junagadh'], ['Talav Gate', 'Junagadh'], ['Chotila Highway', 'Chotila'], ['Vallabh Vidyanagar Road', 'Anand'], ['College Road', 'Nadiad'],
  ['Modhera Cross Road', 'Mehsana'], ['Radhanpur Cross Road', 'Patan'], ['Zadeshwar Chowkdi', 'Bharuch'], ['GIDC Char Rasta', 'Vapi'], ['Tagore Road', 'Gandhidham']
].map(([location, city], index) => ({ id: `CAM-GJ-${String(index + 1).padStart(3, '0')}`, location, city }));

export default function SentinelCommandCenter() {
  const [result, setResult] = useState(null);
  const [plateNumber, setPlateNumber] = useState('GJ01AB1234');
  const [cameraFilter, setCameraFilter] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = io({ reconnectionAttempts: 3 });
    socket.on('sentinel-demo-update', setResult);
    return () => socket.disconnect();
  }, []);

  const runTestCase = async () => {
    setRunning(true);
    setError('');
    try {
      const response = await axios.post('/api/sentinel/demo/run-test-case', { plateNumber });
      setResult(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to run the demo.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">SENTINEL-X / DEMO</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Command Center</h2>
          <p className="mt-1 text-sm text-slate-500">See, identify, correlate, reason, alert, act.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono uppercase outline-none focus:border-cyan-500" aria-label="Designated vehicle plate" />
          <button onClick={runTestCase} disabled={running || !plateNumber.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-60">
            <Play className="h-4 w-4" />
            {running ? 'Running pipeline...' : 'Run 50-camera test case'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Cameras', result?.cameras || 0, Car],
          ['Detections', result?.detections?.length || 0, Activity],
          ['Route points', result?.route?.length || 0, MapPin],
          ['Active alerts', result?.alert ? 1 : 0, AlertTriangle]
        ].map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Icon className="h-4 w-4 text-cyan-600" />
            <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Gujarat live camera grid</p><p className="mt-1 text-sm text-slate-400">30 registered feeds · IDs are used for detection, evidence, and route tracking</p></div>
          <input value={cameraFilter} onChange={(event) => setCameraFilter(event.target.value)} placeholder="Filter camera or place" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500" aria-label="Filter Gujarat cameras" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {gujaratCameras.filter((camera) => `${camera.id} ${camera.location} ${camera.city}`.toLowerCase().includes(cameraFilter.toLowerCase())).map((camera) => (
            <div key={camera.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3 transition hover:border-cyan-500">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />LIVE</div>
              <p className="mt-5 text-center font-mono text-sm font-black text-white">{camera.id}</p>
              <p className="mt-1 text-center text-xs text-slate-400">{camera.location}</p>
              <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-cyan-400">{camera.city}, Gujarat</p>
            </div>
          ))}
        </div>
      </div>

      {result ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Vehicle timeline</p><h3 className="mt-1 font-mono text-xl font-black text-slate-900">{result.plateNumber}</h3></div>
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">WATCHLIST</span>
            </div>
            <div className="mt-5 space-y-4">
              {result.route.map((point) => <div key={`${point.cameraId}-${point.timestamp}`} className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500 ring-4 ring-cyan-50" /><div className="flex-1"><p className="text-sm font-bold text-slate-800">{point.cameraId}</p><p className="text-xs text-slate-500">{formatTime(point.timestamp)} · GIS route point</p></div><MapPin className="h-4 w-4 text-slate-300" /></div>)}
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-xl border border-red-200 bg-red-50 p-5"><div className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" /><h3 className="font-black">Critical alert</h3></div><p className="mt-3 text-sm font-semibold text-red-900">{result.alert.title}</p><p className="mt-2 text-xs text-red-700">Authority: {result.authority.name}</p><p className="mt-1 text-xs text-red-700">Action: {result.authority.action}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="font-black text-slate-900">Pipeline status</h3></div><p className="mt-3 text-sm text-slate-600">Vehicle detected, tracked, normalized, matched and routed to authority.</p><p className="mt-3 text-xs font-bold uppercase tracking-widest text-emerald-600">DEMO records persisted in MongoDB</p></div>
          </div>
        </div>
      ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center text-sm text-slate-500">Run the controlled test case to populate the operational workflow.</div>}
    </section>
  );
}