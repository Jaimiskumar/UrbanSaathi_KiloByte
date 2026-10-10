import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, MapPin, RefreshCw } from 'lucide-react';

const statuses = ['Reported', 'Assigned', 'Verification', 'In Progress', 'Resolved', 'Verified Resolved', 'Issue Still Present', 'Rejected'];

export default function RoadIntelligence() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/road-issues', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIssues(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load road intelligence reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const updateStatus = async (issueId, status) => {
    try {
      await axios.patch(`/api/road-issues/${issueId}/status`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIssues((current) => current.map((issue) => issue._id === issueId ? { ...issue, status } : issue));
      toast.success('Report status updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update status');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.2em] uppercase text-blue-600">Verified road context</p>
          <h1 className="text-3xl font-black text-slate-900">Road Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">Review citizen reports with GIS, maintenance history, risk, and action status.</p>
        </div>
        <button onClick={fetchIssues} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:border-blue-400">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
      ) : issues.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          No road issue reports are available.
        </div>
      ) : (
        <div className="grid gap-4">
          {issues.map((issue) => {
            const intelligence = issue.roadIntelligence || {};
            const road = intelligence.kgisRoad;
            const history = intelligence.verifiedRoadHistory;
            const aiPrediction = intelligence.aiPrediction;
            const contractorName = history?.contractor?.name || aiPrediction?.predictedContractor;
            const contractorSource = history?.contractor?.name ? 'Verified road history' : aiPrediction?.predictedContractor ? `AI prediction · ${Math.round((aiPrediction.confidence || 0) * 100)}% confidence` : 'Pending model result';
            return (
              <article key={issue._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">{issue.issueType}</h2>
                      {issue.source === 'demo_road_intelligence' && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase">Demo data</span>}
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-black">{issue.priority || 'MEDIUM'}</span>
                      {issue.riskScore > 0 && <span className="text-xs font-bold text-slate-500">Risk {issue.riskScore}/100</span>}
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><MapPin className="w-4 h-4 text-blue-600" />{issue.locationName}</p>
                    <p className="text-xs text-slate-400 mt-1">{issue.coordinates?.lat}, {issue.coordinates?.lng}</p>
                  </div>
                  <select value={issue.status} onChange={(event) => updateStatus(issue._id, event.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 bg-white">
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3"><p className="text-[10px] font-black uppercase text-slate-400">KGIS road</p><p className="font-bold text-slate-800">{road?.id || 'Unavailable'}</p><p className="text-xs text-slate-500">{road?.roadClass || 'No verified road class'}</p></div>
                  <div className="bg-slate-50 rounded-xl p-3"><p className="text-[10px] font-black uppercase text-slate-400">BBMP history</p><p className="font-bold text-slate-800">{history?.bbmpSegmentId || 'Unavailable'}</p><p className="text-xs text-slate-500">{history?.streetName || intelligence.message || 'No verified history'}</p></div>
                  <div className="bg-slate-50 rounded-xl p-3"><p className="text-[10px] font-black uppercase text-slate-400">Assigned contractor</p><p className="font-bold text-slate-800">{contractorName || 'Pending assignment'}</p><p className="text-xs text-slate-500">{contractorSource}</p></div>
                </div>
                {aiPrediction?.predictedContractor && history?.contractor?.name && <p className="mt-3 text-xs font-bold text-slate-600">AI predicted contractor: <span className="text-blue-700">{aiPrediction.predictedContractor}</span> ({Math.round((aiPrediction.confidence || 0) * 100)}% confidence)</p>}
                <div className="mt-4 flex items-start gap-2 text-sm text-slate-600"><AlertTriangle className="w-4 h-4 mt-0.5 text-orange-500" /><span>{issue.aiRecommendation || 'Review the report and schedule field verification.'}</span></div>
                {issue.status === 'Verified Resolved' && <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="w-4 h-4" />Resolution verified</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}