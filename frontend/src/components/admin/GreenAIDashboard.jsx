import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  Bot,
  Camera,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';

const scenarios = [
  {
    id: 'stable',
    title: 'Stable corridor',
    feature: 'traffic_analysis',
    eventType: 'TRAFFIC_ANALYSIS_REQUEST',
    description: 'Fresh low traffic, short queue, stable scene.',
    context: {
      timeOfDay: 'DAYTIME',
      trafficDensityVehPerKm: 8,
      queueLengthVehicles: 2,
      sceneChanged: false,
      incidentActive: false
    }
  },
  {
    id: 'peak',
    title: 'Congested peak',
    feature: 'route_request',
    eventType: 'ROUTE_REQUEST',
    description: 'Peak period plus measured high density and queue.',
    context: {
      timeOfDay: 'EVENING_PEAK',
      trafficDensityVehPerKm: 62,
      queueLengthVehicles: 28,
      sceneChanged: false,
      incidentActive: false
    }
  },
  {
    id: 'incident',
    title: 'Accident + low visibility',
    feature: 'accident_response',
    eventType: 'ACCIDENT_DETECTED',
    description: 'Mandatory safety allocation; faster sampling.',
    context: {
      timeOfDay: 'NIGHT',
      visibilityKm: 1.2,
      rainIntensityMmph: 8,
      incidentActive: true
    },
    detection: { severity: 'CRITICAL', class: 'accident' }
  }
];

const formatPercent = (value) => value !== null && value !== undefined && Number.isFinite(Number(value))
  ? `${(Number(value) * 100).toFixed(1)}%`
  : 'Not measured';

const formatBytes = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Unavailable';
  const gigabytes = Number(value) / (1024 ** 3);
  return `${gigabytes.toFixed(1)} GB`;
};

function StatusPill({ state, children }) {
  const colors = state === 'ready' || state === 'live'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : state === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${colors}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === 'ready' || state === 'live' ? 'bg-emerald-500' : state === 'warning' ? 'bg-amber-500' : 'bg-slate-400'}`} />
      {children}
    </span>
  );
}

function LayerCard({ number, icon: Icon, title, subtitle, status, children, accent }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Layer {number}</p>
              <h2 className="mt-0.5 text-base font-extrabold text-slate-900">{title}</h2>
            </div>
          </div>
          {status}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">{subtitle}</p>
        <div className="mt-5 border-t border-slate-100 pt-4">{children}</div>
      </div>
    </section>
  );
}

function Value({ label, value, detail }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-extrabold text-slate-800">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{detail}</p>}
    </div>
  );
}

export default function GreenAIDashboard() {
  const [status, setStatus] = useState(null);
  const [modelHealth, setModelHealth] = useState(null);
  const [registry, setRegistry] = useState(null);
  const [loadErrors, setLoadErrors] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [runningScenario, setRunningScenario] = useState('');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const requests = await Promise.allSettled([
      axios.get('/api/urbanflow/green-ai/status'),
      axios.get('/api/ml-detection/status'),
      axios.get('/api/urbanflow/agents/registry')
    ]);
    const failures = [];
    if (requests[0].status === 'fulfilled') setStatus(requests[0].value.data);
    else failures.push('Runtime, local dataset and workload status are unavailable.');
    if (requests[1].status === 'fulfilled') setModelHealth(requests[1].value.data);
    else failures.push('ML model service is unavailable.');
    if (requests[2].status === 'fulfilled') setRegistry(requests[2].value.data);
    else failures.push('Agent registry is unavailable.');
    setLoadErrors(failures);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const modelsLoaded = useMemo(() => (
    Object.entries(modelHealth?.models_loaded || {}).filter(([, loaded]) => loaded).map(([name]) => name)
  ), [modelHealth]);
  const agentDefinitions = registry?.agents || [];
  const availableAgents = agentDefinitions.filter((agent) => agent.registered);
  const latestDecision = status?.latestWorkloadDecision;
  const latestTrace = latestDecision?.executionTrace || [];
  const traceMaxDuration = Math.max(1, ...latestTrace.map((entry) => entry.durationMs || 0));
  const benchmark = status?.benchmark?.report;
  const baseline = benchmark?.modes?.baseline;
  const optimizedEntries = Object.entries(benchmark?.modes || {})
    .filter(([name]) => name !== 'baseline');
  const memoryUsedPct = status?.runtime?.hostMemoryBytes
    ? (1 - status.runtime.hostFreeMemoryBytes / status.runtime.hostMemoryBytes) * 100
    : null;

  const runScenario = async (scenario) => {
    setRunningScenario(scenario.id);
    setScenarioResult(null);
    try {
      const response = await axios.post('/api/urbanflow/agents/plan', {
        requestedFeature: scenario.feature,
        eventType: scenario.eventType,
        detection: scenario.detection,
        context: { ...scenario.context, observedAt: new Date().toISOString() },
        simulation: true
      });
      setScenarioResult({ ...response.data, scenario });
    } catch (error) {
      setLoadErrors((previous) => [
        ...previous.filter((message) => message !== 'Scenario preview could not be generated.'),
        'Scenario preview could not be generated.'
      ]);
    } finally {
      setRunningScenario('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" /> Green AI · layered workload control
              </div>
              <h1 className="max-w-3xl text-2xl font-black tracking-tight sm:text-4xl">Spend compute where the road needs it.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                One view across model efficiency, feature-selected agents and context-aware sampling. Live values come from connected services; unavailable telemetry stays explicitly unavailable.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill state={status ? 'live' : 'unknown'}>{status ? 'Runtime connected' : 'Connecting'}</StatusPill>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          <div className="relative mt-7 grid gap-3 md:grid-cols-3">
            {[
              ['01', 'Optimize each inference', 'Baseline / eligible precision', 'from-cyan-400 to-blue-500'],
              ['02', 'Select only required agents', 'Feature policy + safety rules', 'from-violet-400 to-indigo-500'],
              ['03', 'Adapt cadence to context', 'Validated inputs + bounded sampling', 'from-emerald-400 to-teal-500']
            ].map(([number, title, caption, color], index) => (
              <div key={number} className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-xs font-black`}>{number}</span>
                <div>
                  <p className="text-xs font-extrabold">{title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{caption}</p>
                </div>
                {index < 2 && <span className="absolute -right-2 z-10 hidden h-4 w-4 rotate-45 border-r border-t border-white/30 bg-slate-900 lg:block" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      {loadErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Some sources are unavailable</div>
          <ul className="mt-2 list-inside list-disc space-y-1">{loadErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <LayerCard
          number="01"
          icon={Zap}
          title="Model-level optimization"
          subtitle="The existing detector service selects only a supported precision and falls back to baseline when needed."
          accent="from-cyan-500 to-blue-600"
          status={<StatusPill state={modelHealth?.available ? 'ready' : 'unknown'}>{modelHealth?.available ? 'ML online' : 'ML unavailable'}</StatusPill>}
        >
          <div className="grid grid-cols-2 gap-4">
            <Value label="Configured precision" value={modelHealth?.inference_optimization?.default_requested_precision || 'Unavailable'} />
            <Value label="Loaded models" value={modelHealth?.models_loaded ? `${modelsLoaded.length} / ${Object.keys(modelHealth.models_loaded).length}` : 'Unavailable'} />
          </div>
          <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3">
            <Value
              label="Model/runtime from latest inference event"
              value={latestDecision?.modelUsage?.length
                ? latestDecision.modelUsage.map((usage) => `${usage.model} · ${usage.precision}`).join(', ')
                : 'Not reported by the latest workflow'}
              detail={latestDecision?.modelUsage?.[0]?.runtime || 'No runtime claim is inferred from model availability.'}
            />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Power and accuracy evidence</p>
            {status?.benchmark?.available && benchmark ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{benchmark.modelName || 'Detector'} · {benchmark.acceptanceStatus}</span>
                  <span className="font-bold text-slate-500">{benchmark.accuracyValidation?.status || 'accuracy unreported'}</span>
                </div>
                {optimizedEntries.map(([name, mode]) => (
                  <div key={name} className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2 text-[10px]">
                    <span className="font-bold uppercase text-indigo-700">{name}</span>
                    <span className="text-slate-600">{mode.energyPerInferenceJoules === null ? 'Energy unavailable' : `${Number(mode.energyPerInferenceJoules).toFixed(4)} J/inference`}</span>
                    <span className="text-slate-600">{mode.p95LatencyMs === null ? 'p95 unavailable' : `p95 ${Number(mode.p95LatencyMs).toFixed(1)} ms`}</span>
                  </div>
                ))}
                {benchmark.measurementNotes?.energy && <p className="text-[9px] leading-4 text-slate-500">{benchmark.measurementNotes.energy}</p>}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-slate-600">No measured baseline-versus-optimized report is present. Energy savings and accuracy impact are not claimed.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {modelsLoaded.slice(0, 8).map((model) => (
              <span key={model} className="rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1 text-[9px] font-semibold text-cyan-800">{model.replaceAll('_', ' ')}</span>
            ))}
            {modelsLoaded.length === 0 && <span className="text-[10px] text-slate-500">Model inventory is not available.</span>}
          </div>
        </LayerCard>

        <LayerCard
          number="02"
          icon={Bot}
          title="Feature-driven allocation"
          subtitle="The existing LangGraph selects registered specialists and dependencies for each request."
          accent="from-violet-500 to-indigo-600"
          status={<StatusPill state={registry ? 'ready' : 'unknown'}>{registry ? `${availableAgents.length} registered` : 'Registry unavailable'}</StatusPill>}
        >
          <div className="grid grid-cols-2 gap-4">
            <Value label="Registered agents" value={registry ? `${availableAgents.length} / ${agentDefinitions.length}` : 'Unavailable'} detail="Registration is not a live health probe." />
            <Value label="Last feature" value={latestDecision?.requestedFeature?.replaceAll('_', ' ') || 'No event yet'} detail={latestDecision?.occurredAt ? new Date(latestDecision.occurredAt).toLocaleString() : 'Waiting for an actual workflow'} />
          </div>
          {latestDecision ? (
            <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Planned agents · activation reason</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(latestDecision.selectedAgents || []).length
                    ? latestDecision.selectedAgents.map((agent) => (
                        <span key={agent} title={latestDecision.activationReasons?.[agent] || 'Selected by feature policy.'} className="rounded-lg bg-indigo-100 px-2 py-1 text-[9px] font-bold text-indigo-800">
                          {agent}<span className="ml-1 font-medium text-indigo-700">· {latestDecision.activationReasons?.[agent] || 'Policy selected'}</span>
                        </span>
                      ))
                    : <span className="text-[10px] text-slate-500">No registered AI agent was required for the latest event.</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Actually executed · {latestDecision.workflowStatus || 'PLANNED'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(latestDecision.actualAgents || []).length
                    ? latestDecision.actualAgents.map((agent) => <span key={agent} className="rounded-lg bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">{agent}</span>)
                    : <span className="text-[10px] text-slate-500">Execution has not completed or no agent was invoked.</span>}
                </div>
              </div>
              {(latestDecision.skippedAgents || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Not selected by policy</p>
                  <ul className="mt-1 space-y-1">
                    {latestDecision.skippedAgents.map((item) => (
                      <li key={item.agent} className="text-[10px] leading-4 text-slate-500">
                        <span className="font-bold text-slate-700">{item.agent}:</span> {item.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[9px] text-slate-500">Mandatory accident/emergency work cannot be disabled by ordinary feature preferences.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              Actual activation reasons and skipped-agent traces appear after a workflow runs; the registry alone is not presented as execution.
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Accident and emergency specialists remain mandatory.
          </p>
        </LayerCard>

        <LayerCard
          number="03"
          icon={Activity}
          title="Context-aware workload"
          subtitle="Fresh local signals raise cadence; missing or stale context falls back to the normal monitoring interval."
          accent="from-emerald-500 to-teal-600"
          status={<StatusPill state={latestDecision ? 'live' : 'unknown'}>{latestDecision?.mode || 'Awaiting event'}</StatusPill>}
        >
          {latestDecision ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Value label="Requested detector interval" value={`${(latestDecision.sampling.intervalMs / 1000).toFixed(1)} sec`} detail={`Configured maximum gap between detector requests: ${latestDecision.sampling.maximumDetectionDelayMs / 1000}s`} />
                <Value label="Context freshness" value={latestDecision.context.freshness.replaceAll('_', ' ')} detail={latestDecision.context.observedAt || 'No timestamp provided'} />
              </div>
              <ul className="mt-4 space-y-2">
                {latestDecision.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2 text-[10px] leading-4 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" /> {reason}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs leading-5 text-slate-500">
              No workload decision has been recorded in this backend process. Sampling remains at the configured normal cadence; no savings are inferred.
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
            <Value label="Weather" value={status?.contextSources?.weatherApiConfigured ? 'API configured' : status?.contextSources?.weatherDemoMode ? 'Demo mode' : 'Unavailable'} />
            <Value label="Festival feed" value={status?.contextSources?.festivalCalendar || 'Unknown'} />
          </div>
        </LayerCard>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Activity className="h-4 w-4 text-emerald-600" /> Live agent execution trace
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">
              {latestDecision?.workflowStatus === 'MONITORING'
                ? 'Latest camera monitoring decision'
                : 'From feature request to verified outcome'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {latestDecision?.workflowStatus === 'MONITORING'
                ? 'This is the latest real camera inference decision; no agent workflow was required for that frame.'
                : 'This is the most recent LangGraph workflow in this backend process—not a simulation or a count inferred from the registry.'}
            </p>
          </div>
          <StatusPill state={latestDecision?.workflowStatus === 'COMPLETED' ? 'live' : latestDecision?.workflowStatus === 'DEGRADED' ? 'warning' : 'unknown'}>
            {latestDecision?.workflowStatus || 'No completed workflow'}
          </StatusPill>
        </div>

        {latestDecision && latestDecision.workflowStatus !== 'PLANNED' ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Value label="Feature / event" value={`${latestDecision.requestedFeature || 'Unspecified'}${latestDecision.eventId ? ` · ${latestDecision.eventId}` : ''}`} />
              <Value label="Workflow duration" value={latestDecision.measurements?.totalLatencyMs != null ? `${latestDecision.measurements.totalLatencyMs} ms` : 'Not measured'} detail={`Updated ${new Date(latestDecision.occurredAt).toLocaleTimeString()}`} />
              <Value label="Agent executions" value={`${latestDecision.successfulExecutionCount || 0} / ${latestDecision.executionCount || 0} succeeded`} detail={`${(latestDecision.actualAgents || []).length} distinct agents invoked`} />
              <Value label="Energy attribution" value={latestDecision.measurements?.energy?.status === 'measured' ? 'Measured' : 'Unavailable'} detail={latestDecision.measurements?.energy?.reason || 'No per-workflow power telemetry is connected.'} />
            </div>

            <ol className="mt-5 space-y-2">
              {latestTrace.map((entry, index) => {
                const statusStyle = entry.status === 'SUCCESS'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : entry.status === 'ERROR' || entry.status === 'BLOCKED'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600';
                const barStyle = entry.status === 'SUCCESS'
                  ? 'bg-emerald-500'
                  : entry.status === 'ERROR' || entry.status === 'BLOCKED'
                    ? 'bg-rose-500'
                    : 'bg-slate-300';
                const width = `${Math.max(4, ((entry.durationMs || 0) / traceMaxDuration) * 100)}%`;
                return (
                  <li key={`${entry.agent}-${entry.stage}-${index}`} className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(100px,0.5fr)_auto] sm:items-center ${statusStyle}`}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-extrabold">{entry.agent} <span className="font-medium opacity-70">· {entry.stage}</span></p>
                      <p className="mt-0.5 text-[10px] leading-4 opacity-80">{entry.error || entry.reason || 'Executed by the workflow graph.'}</p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
                      <div className={`h-full rounded-full ${barStyle}`} style={{ width }} />
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase">
                      <span>{entry.status}</span><span>{entry.durationMs || 0} ms</span>
                    </div>
                  </li>
                );
              })}
            </ol>
            {latestTrace.length === 0 && (
              <p className="mt-4 text-xs text-slate-500">
                {latestDecision.workflowStatus === 'MONITORING'
                  ? 'No actionable event was sent to agents for this camera frame.'
                  : 'The workflow completed without per-agent trace entries.'}
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-xs leading-5 text-slate-500">
            Waiting for a completed real workflow. Start the camera ML detection feed or submit a real traffic, road-hazard, or emergency event. The scenario buttons below only preview policy and do not count as execution.
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                <Gauge className="h-4 w-4 text-cyan-600" /> Runtime and data provenance
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-slate-900">What is connected right now</h2>
            </div>
            <StatusPill state={status?.database?.connected ? 'ready' : 'warning'}>{status?.database?.state || 'Checking database'}</StatusPill>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Cpu className="h-4 w-4 text-indigo-600" /> Host</div>
              <p className="mt-2 text-xs font-extrabold text-slate-800">{status?.runtime?.cpuModel || 'Not reported'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{status?.runtime?.cpuCores ?? '–'} logical CPU cores · process RSS {formatBytes(status?.runtime?.processMemoryBytes)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Database className="h-4 w-4 text-cyan-600" /> Memory</div>
              <p className="mt-2 text-xs font-extrabold text-slate-800">{memoryUsedPct === null ? 'Not reported' : `${memoryUsedPct.toFixed(1)}% used`}</p>
              <p className="mt-1 text-[10px] text-slate-500">{formatBytes(status?.runtime?.hostFreeMemoryBytes)} free / {formatBytes(status?.runtime?.hostMemoryBytes)} host memory</p>
              {memoryUsedPct !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(100, Math.max(0, memoryUsedPct))}%` }} /></div>}
            </div>
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Camera className="h-4 w-4 text-emerald-600" /> Runtime</div>
              <p className="mt-2 text-xs font-extrabold text-slate-800">{status?.runtime?.nodeVersion || 'Not reported'}</p>
              <p className="mt-1 text-[10px] text-slate-500">{status?.runtime?.platform || 'Platform unavailable'} · updated {status?.observedAt ? new Date(status.observedAt).toLocaleTimeString() : '–'}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
            <Database className="h-4 w-4 text-amber-600" /> Local source datasets
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {status?.datasets?.rootAvailable
              ? `${status.datasets.availableCount} of ${status.datasets.totalCount} expected dataset locations found · ${status.datasets.source}.`
              : 'Dataset root was not found. Configure URBANSAATHI_DATASET_ROOT to use the local training collections.'}
            {' '}No assets are copied into the application by this dashboard.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(status?.datasets?.items || []).map((dataset) => (
              <div key={dataset.name} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                <span className="text-[10px] font-semibold text-slate-700">{dataset.name}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${dataset.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {dataset.available ? 'FOUND' : 'MISSING'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
            <Layers3 className="h-4 w-4 text-violet-600" /> Reproducible workload preview
          </div>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">Try the bounded policy</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Deterministic dry-run only. These scenarios do not call models, dispatch agents, alter signals or represent live traffic.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {scenarios.map((scenario) => (
              <button
                type="button"
                key={scenario.id}
                onClick={() => runScenario(scenario)}
                disabled={Boolean(runningScenario)}
                className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex items-center justify-between gap-2 text-xs font-extrabold text-slate-800">
                  {scenario.title}
                  {runningScenario === scenario.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" /> : <Clock3 className="h-3.5 w-3.5 text-slate-400" />}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-slate-500">{scenario.description}</span>
              </button>
            ))}
          </div>

          {scenarioResult && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-amber-950">{scenarioResult.scenario.title} · preview</p>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-800">Simulation · not live</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Value label="Workload mode" value={scenarioResult.workload.mode} />
                <Value label="Sampling interval" value={`${(scenarioResult.workload.sampling.intervalMs / 1000).toFixed(1)} sec`} />
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected agents</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-700">
                  {scenarioResult.plan.selectedAgents.length ? scenarioResult.plan.selectedAgents.join(', ') : 'No AI agent selected'}
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {scenarioResult.workload.reasons.map((reason) => <li key={reason} className="text-[10px] leading-4 text-slate-600">• {reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Activity className="h-4 w-4 text-indigo-600" /> Existing model evaluation artifacts
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">Training metrics, with provenance</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">Artifact-reported · not a live test</span>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">{status?.trainingMetrics?.source || 'Training report unavailable.'}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(status?.trainingMetrics?.models || {}).map(([name, metrics]) => (
            <div key={name} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-extrabold text-slate-800">{name.replaceAll('_', ' ')}</h3>
                <StatusPill state={metrics.datasetType === 'real' ? 'ready' : 'unknown'}>{metrics.datasetType}</StatusPill>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{metrics.architecture || 'Architecture not reported'} · {metrics.samples === null ? 'sample count unavailable' : `${metrics.samples.toLocaleString()} samples`}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Value label="Accuracy" value={formatPercent(metrics.accuracy)} />
                <Value label="F1" value={formatPercent(metrics.f1Score)} />
                {metrics.mAP50 !== null && <Value label="mAP50" value={formatPercent(metrics.mAP50)} />}
                {metrics.mAP50_95 !== null && <Value label="mAP50–95" value={formatPercent(metrics.mAP50_95)} />}
              </div>
              <p className="mt-3 text-[9px] text-slate-400">Report timestamp: {metrics.trainedAt || 'not recorded'}</p>
            </div>
          ))}
          {Object.keys(status?.trainingMetrics?.models || {}).length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">No local model training metrics artifact is available.</div>
          )}
        </div>
      </section>
    </div>
  );
}
