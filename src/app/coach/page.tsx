/**
 * /coach — Daily AI Health Coaching
 * Pre-chat: key metrics display + manual inputs
 * Chat: clean 1-3 turn coaching conversation
 * History: summary + expandable full conversation
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Metrics {
  readiness?: number | null;
  hrv?: number | null;
  resting_hr?: number | null;
  spo2?: number | null;
  sleep_score?: number | null;
  sleep_total?: number | null;
  deep_sleep_min?: number | null;
  rem_sleep_min?: number | null;
  sleep_efficiency?: number | null;
  cv_age?: number | null;
  stress_min?: number | null;
  restored_min?: number | null;
  recovery_status?: string | null;
  resilience?: string | null;
  resilience_pct?: number | null;
  weight?: number | null;
  weight_stale?: boolean;
  back_pain?: number | null;
  yesterday_activities?: {
    id?: number;
    name?: string;
    type?: string;
    distance?: number;
    moving_time?: number;
    total_elevation_gain?: number;
    average_heartrate?: number;
  }[];
}

interface HistorySession {
  date: number;
  advice_full: string;
  advice_summary: string | null;
  conversation_turns: number;
}

interface TrendInfo {
  direction: 'up' | 'down' | 'stable';
  healthImpact: 'positive' | 'negative' | 'neutral';
  significant: boolean;
}

function TrendArrow({ trend }: { trend?: TrendInfo }) {
  if (!trend) return null;
  if (!trend.significant || trend.direction === 'stable') {
    return <span className="text-xs ml-1 text-zinc-500">―</span>;
  }
  const arrow = trend.direction === 'up' ? '\u25B2' : '\u25BC';
  const color = trend.healthImpact === 'positive' ? 'text-green-400'
    : trend.healthImpact === 'negative' ? 'text-red-400'
    : 'text-gray-400';
  return <span className={`text-xs ml-1 ${color}`}>{arrow}</span>;
}

function Sparkline({ data }: { data: (number | null)[] }) {
  const points = data.map((v, i) => ({ v, i })).filter(p => p.v != null) as { v: number; i: number }[];
  if (points.length < 2) return null;

  const W = 48, H = 16;
  const xs = points.map(p => p.i);
  const ys = points.map(p => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const toSVG = (i: number, v: number) => ({
    x: ((i - minX) / rangeX) * W,
    y: H - ((v - minY) / rangeY) * H,
  });

  const pts = points.map(p => {
    const { x, y } = toSVG(p.i, p.v);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={W} height={H} className="block mt-1" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ label, value, unit, warn, trend, sparkline, href }: { label: string; value: unknown; unit?: string; warn?: boolean; trend?: TrendInfo; sparkline?: (number | null)[]; href?: string }) {
  if (value === null || value === undefined) return null;
  const content = (
    <div className={`h-full flex flex-col bg-zinc-900 border ${warn ? 'border-yellow-600' : 'border-zinc-800'} rounded-lg px-3 py-2 ${href ? 'cursor-pointer hover:border-zinc-600 transition-colors' : ''}`}>
      <div className="text-xs text-gray-500 truncate">{label}</div>
      <div className="text-lg font-semibold text-white whitespace-nowrap">
        {String(value)}{unit && <span className="text-sm text-gray-400 ml-0.5">{unit}</span>}
        <TrendArrow trend={trend} />
      </div>
      {sparkline && <div className="mt-auto"><Sparkline data={sparkline} /></div>}
    </div>
  );
  if (href) {
    return <Link href={href} className="h-full">{content}</Link>;
  }
  return content;
}

function ActivityRow({ activity }: { activity: Metrics['yesterday_activities'] extends (infer T)[] | undefined ? T : never }) {
  const dist = activity.distance ? `${(activity.distance / 1609.34).toFixed(1)}mi` : '';
  const elev = activity.total_elevation_gain ? `${Math.round(activity.total_elevation_gain * 3.281)}ft` : '';
  const time = activity.moving_time ? `${Math.round(activity.moving_time / 60)}min` : '';
  const hr = activity.average_heartrate ? `HR ${Math.round(activity.average_heartrate)}` : '';
  const parts = [dist, elev, time, hr].filter(Boolean).join(' · ');
  const name = activity.name || 'Activity';
  return (
    <div className="text-sm text-gray-300">
      {activity.id ? (
        <a href={`https://www.strava.com/activities/${activity.id}`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-orange-400 underline decoration-zinc-600 hover:decoration-orange-400 transition-colors">{name}</a>
      ) : (
        <span className="text-white">{name}</span>
      )}
      <span className="text-gray-500 ml-1">({activity.type})</span>
      {parts && <span className="text-gray-400 ml-2">{parts}</span>}
    </div>
  );
}

export default function CoachPage() {
  useEffect(() => { document.title = '8i11 | Coach'; }, []);

  // Manual inputs
  const [weight, setWeight] = useState('');
  const [backPain, setBackPain] = useState(0);
  const [backNotes, setBackNotes] = useState('');
  const [bowel, setBowel] = useState('');
  const [injuries, setInjuries] = useState('');

  // Data state
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [dataInjection, setDataInjection] = useState('');
  const [trends, setTrends] = useState<Record<string, TrendInfo>>({});
  const [sparklines, setSparklines] = useState<Record<string, (number | null)[]>>({});

  // History
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [savedSummary, setSavedSummary] = useState('');
  const [totalTokens, setTotalTokens] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-CA');
  const epochDay = Math.floor(Date.now() / 86400000);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load metrics on mount (Oura + Strava, then trends)
  useEffect(() => {
    // Repaint instantly from today's cache, then refresh in the background
    const cache_key = `coach_metrics_${dateStr}`;
    try {
      const cached = sessionStorage.getItem(cache_key);
      if (cached) {
        const c = JSON.parse(cached);
        if (c.metrics) setMetrics(c.metrics);
        if (c.trends) setTrends(c.trends);
        if (c.sparklines) setSparklines(c.sparklines);
        setMetricsLoading(false);
      }
    } catch { /* corrupt cache — ignore */ }

    async function loadMetrics() {
      try {
        // Fetch Oura and Strava in parallel
        const [ouraRes, stravaRes] = await Promise.all([
          fetch(`/api/oura/data?date=${dateStr}`).catch(() => null),
          fetch('/api/strava/data').catch(() => null),
        ]);

        const ouraData = ouraRes?.ok ? await ouraRes.json() : null;
        const stravaData = stravaRes?.ok ? await stravaRes.json() : null;

        // Build a preview injection to get metrics
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        // Extract yesterday's activities from Strava
        const stravaActivities = stravaData?.activities?.filter(
          (a: { start_date_local?: string }) => a.start_date_local?.startsWith(yesterdayStr)
        ) || [];

        // Quick metrics extraction from Oura data
        const m: Metrics = {};
        if (ouraData?.success) {
          const scores = ouraData.scores || {};
          m.readiness = scores.readiness ?? null;
          m.hrv = scores.hrv_average ?? null;
          m.resting_hr = scores.resting_hr ?? null;
          m.spo2 = scores.spo2_average ?? null;
          m.sleep_score = scores.sleep ?? null;

          // Sleep durations come from sleep_detail (period data), not daily_sleep (scores only)
          const sleep_detail_arr = ouraData.sleep_detail as Record<string, unknown>[] | null;
          const sleep_period = Array.isArray(sleep_detail_arr) && sleep_detail_arr.length > 0
            ? (sleep_detail_arr.find(s => s.type === 'long_sleep') ?? sleep_detail_arr[0])
            : null;
          if (sleep_period) {
            m.sleep_total = sleep_period.total_sleep_duration ? Math.round(Number(sleep_period.total_sleep_duration) / 60) : null;
            m.deep_sleep_min = sleep_period.deep_sleep_duration ? Math.round(Number(sleep_period.deep_sleep_duration) / 60) : null;
            m.rem_sleep_min = sleep_period.rem_sleep_duration ? Math.round(Number(sleep_period.rem_sleep_duration) / 60) : null;
            m.sleep_efficiency = sleep_period.efficiency ? Number(sleep_period.efficiency) : null;
          }

          const stress = ouraData.stress;
          if (stress) {
            m.stress_min = stress.stress_high ? Math.round(stress.stress_high / 60) : null;
            m.restored_min = stress.recovery_high ? Math.round(stress.recovery_high / 60) : null;
            // Client-side resilience from today's stress/recovery
            if (m.stress_min != null && m.restored_min != null) {
              const total = m.stress_min + m.restored_min;
              if (total > 0) {
                const pct = Math.round((m.restored_min / total) * 100);
                m.resilience_pct = pct;
                if (pct >= 65) m.resilience = 'High recovery, low stress';
                else if (pct >= 50) m.resilience = 'Balanced';
                else if (pct >= 35) m.resilience = 'Elevated stress';
                else m.resilience = 'High stress, low recovery';
              }
            }
          }
        }

        // Client-side recovery estimate (upgraded by server after inject)
        if (m.readiness !== null && m.readiness !== undefined) {
          const deep_ok = m.deep_sleep_min ? m.deep_sleep_min >= 60 : null;
          const sleep_ok = m.sleep_total ? m.sleep_total >= 420 : null;
          const stress_ratio = (m.stress_min && m.restored_min)
            ? m.restored_min / (m.stress_min + m.restored_min) : null;
          let score = 0;
          if (m.readiness >= 85) score += 2; else if (m.readiness >= 70) score += 1;
          else if (m.readiness < 60) score -= 2; else score -= 1;
          if (deep_ok === true) score += 1; if (deep_ok === false) score -= 1;
          if (sleep_ok === true) score += 1; if (sleep_ok === false) score -= 1;
          if (stress_ratio !== null && stress_ratio >= 0.5) score += 1;
          if (stress_ratio !== null && stress_ratio < 0.5) score -= 1;
          if (score >= 4) m.recovery_status = 'Ready to push';
          else if (score >= 2) m.recovery_status = 'Ready, moderate effort';
          else if (score >= 0) m.recovery_status = 'Easy day';
          else if (score >= -2) m.recovery_status = 'Recovery, light movement only';
          else m.recovery_status = 'Rest day';
        }

        // Estimate cardiovascular age from HRV + RHR (Umetani regression)
        // hrv must be > 0 — Math.log(0) = -Infinity
        if (m.hrv && m.hrv > 0 && m.resting_hr) {
          const hrv_age = 107 - (12.5 * Math.log(m.hrv));
          const rhr_age = 1.4 * m.resting_hr - 40;
          const estimated = Math.round(0.65 * hrv_age + 0.35 * rhr_age);
          if (isFinite(estimated)) m.cv_age = estimated;
        }

        if (stravaActivities.length > 0) {
          m.yesterday_activities = stravaActivities.slice(0, 5).map((a: Record<string, unknown>) => ({
            id: a.id as number,
            name: a.name, type: a.sport_type || a.type,
            distance: a.distance as number, moving_time: a.moving_time as number,
            total_elevation_gain: a.total_elevation_gain as number,
            average_heartrate: a.average_heartrate as number,
          }));
        }

        setMetrics(m);

        // POST live metrics to ensure today's daily_metrics row exists, then get trends
        try {
          const trendsRes = await fetch('/api/coaching/trends/today', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              metrics: {
                hrv_rmssd: m.hrv ?? null,
                resting_hr: m.resting_hr ?? null,
                spo2_average: m.spo2 ?? null,
                readiness_score: m.readiness ?? null,
                sleep_duration_min: m.sleep_total ?? null,
                deep_sleep_min: m.deep_sleep_min ?? null,
                rem_sleep_min: m.rem_sleep_min ?? null,
                sleep_efficiency_pct: m.sleep_efficiency ?? null,
                cardiovascular_age: m.cv_age ?? null,
              },
            }),
          });
          if (trendsRes.ok) {
            const trendsData = await trendsRes.json();
            const trendMap: Record<string, TrendInfo> = {};
            for (const t of trendsData.trends || []) {
              trendMap[t.slug] = { direction: t.direction, healthImpact: t.healthImpact, significant: t.significant };
            }
            setTrends(trendMap);
            if (trendsData.sparklines) {
              setSparklines(trendsData.sparklines);
            }
            const merged = { ...m };
            if (trendsData.lastWeight) {
              merged.weight = m.weight ?? trendsData.lastWeight.value;
              merged.weight_stale = m.weight ? m.weight_stale : trendsData.lastWeight.stale;
              setMetrics(merged);
            }
            try {
              sessionStorage.setItem(cache_key, JSON.stringify({ metrics: merged, trends: trendMap, sparklines: trendsData.sparklines ?? {} }));
            } catch { /* storage full or unavailable — skip */ }
          }
        } catch {
          // Best effort — arrows just won't show
        }
      } catch {
        // Best effort — metrics pane just won't show
      } finally {
        setMetricsLoading(false);
      }
    }
    loadMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startSession() {
    setLoading(true);
    setError('');

    try {
      // Fetch live data
      const [ouraRes, stravaRes] = await Promise.all([
        fetch(`/api/oura/data?date=${dateStr}`).catch(() => null),
        fetch('/api/strava/data').catch(() => null),
      ]);

      const ouraData = ouraRes?.ok ? await ouraRes.json() : null;
      const stravaData = stravaRes?.ok ? await stravaRes.json() : null;

      // Build data injection on the server
      const injectRes = await fetch('/api/coaching/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_str: dateStr,
          epoch_day: epochDay,
          manual: {
            weight_lbs: weight ? parseFloat(weight) : undefined,
            back_pain_scale: backPain,
            back_mobility_notes: backNotes || undefined,
            bowel_status: bowel || undefined,
            injury_notes: injuries || undefined,
          },
          oura_live: ouraData?.success ? ouraData : undefined,
          strava_activities: stravaData?.activities || undefined,
        }),
      });

      if (!injectRes.ok) throw new Error('Failed to build health data');
      const { injection, metrics: serverMetrics } = await injectRes.json();
      setDataInjection(injection);

      // Update metrics with server-computed values (includes weight trend)
      if (serverMetrics) {
        setMetrics(prev => ({ ...prev, ...serverMetrics, weight: weight ? parseFloat(weight) : prev?.weight }));
      }

      // Send to coaching chat
      const chatRes = await fetch('/api/coaching/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: [],
          user_message: injection,
        }),
      });

      if (!chatRes.ok) {
        const err = await chatRes.json();
        throw new Error(err.error || 'Chat failed');
      }

      const data = await chatRes.json();
      setTotalTokens((data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0));
      setTurnCount(1);

      setMessages([
        { role: 'user', content: injection },
        { role: 'assistant', content: data.response },
      ]);
      setSessionStarted(true);
      setMetricsCollapsed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setLoading(true);
    setError('');

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/coaching/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: messages,
          user_message: userMsg,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Chat failed');
      }

      const data = await res.json();
      setTotalTokens(prev => prev + (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0));
      setTurnCount(data.turn || turnCount + 1);
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  async function saveSession() {
    setLoading(true);
    setError('');

    try {
      const adviceFull = messages
        .map(m => `${m.role === 'assistant' ? 'Coach' : 'You'}: ${m.content}`)
        .join('\n\n');

      const res = await fetch('/api/coaching/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: epochDay,
          date_str: dateStr,
          advice_full: adviceFull,
          conversation_turns: turnCount,
          token_count: totalTokens,
          data_snapshot: dataInjection,
          manual: {
            weight_lbs: weight ? parseFloat(weight) : undefined,
            back_pain_scale: backPain,
            back_mobility_notes: backNotes || undefined,
            bowel_status: bowel || undefined,
            injury_notes: injuries || undefined,
          },
          inject_metrics: metrics ? {
            readiness: metrics.readiness,
            hrv: metrics.hrv,
            resting_hr: metrics.resting_hr,
            spo2: metrics.spo2,
            sleep_total: metrics.sleep_total,
            deep_sleep_min: metrics.deep_sleep_min,
            rem_sleep_min: metrics.rem_sleep_min,
            sleep_efficiency: metrics.sleep_efficiency,
            stress_min: metrics.stress_min,
            restored_min: metrics.restored_min,
          } : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }

      const data = await res.json();
      setFinalized(true);
      setSavedSummary(data.summary || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    if (historyLoaded) {
      setShowHistory(!showHistory);
      return;
    }
    try {
      const res = await fetch('/api/coaching/history?limit=10&offset=0');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.sessions);
        setHistoryTotal(data.total);
        setHistoryLoaded(true);
        setShowHistory(true);
      }
    } catch { /* best effort */ }
  }

  async function loadMoreHistory() {
    setHistoryLoadingMore(true);
    try {
      const res = await fetch(`/api/coaching/history?limit=10&offset=${history.length}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(prev => [...prev, ...data.sessions]);
      }
    } catch { /* best effort */ }
    setHistoryLoadingMore(false);
  }

  function epochDayToDate(epoch: number): string {
    return new Date(epoch * 86400000).toISOString().split('T')[0];
  }

  function formatMinutes(min: number | null | undefined): string {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <NavTabs />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Coach</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{dateStr}</span>
            <button
              onClick={loadHistory}
              className="text-sm text-gray-400 hover:text-white border border-zinc-700 px-3 py-1 rounded transition-colors"
            >
              {showHistory ? 'Hide' : 'History'}
            </button>
          </div>
        </div>

        {/* Past Sessions */}
        {showHistory && (
          <div className="mb-6 space-y-2">
            {history.length === 0 && <p className="text-gray-500 text-sm">No past sessions.</p>}
            {history.map(s => {
              // Parse data snapshot from stored advice_full
              const hasSnapshot = s.advice_full.startsWith('[Data for this session]');
              const convoMarker = '[Conversation]';
              const convoIdx = hasSnapshot ? s.advice_full.indexOf(convoMarker) : -1;
              const dataSnapshot = hasSnapshot && convoIdx > 0
                ? s.advice_full.slice('[Data for this session]\n'.length, convoIdx).trim()
                : null;
              const conversation = convoIdx > 0
                ? s.advice_full.slice(convoIdx + convoMarker.length).trim()
                : s.advice_full;

              return (
                <details key={s.date} className="bg-zinc-900 border border-zinc-800 rounded">
                  <summary className="px-4 py-2 cursor-pointer text-sm text-gray-300 hover:text-white flex justify-between">
                    <span>{epochDayToDate(s.date)}</span>
                    <span className="text-gray-500">{s.conversation_turns} turn{s.conversation_turns !== 1 ? 's' : ''}</span>
                  </summary>
                  <div className="px-4 pb-3 space-y-2">
                    {s.advice_summary && (
                      <p className="text-sm text-gray-300">{s.advice_summary}</p>
                    )}
                    {dataSnapshot && (
                      <details className="text-xs">
                        <summary className="text-gray-500 cursor-pointer">Metrics from this day</summary>
                        <div className="mt-1 text-gray-500 whitespace-pre-wrap bg-zinc-950 rounded p-2">{dataSnapshot}</div>
                      </details>
                    )}
                    <details className="text-xs">
                      <summary className="text-gray-500 cursor-pointer">Full conversation</summary>
                      <div className="mt-1 text-gray-400 whitespace-pre-wrap">{conversation}</div>
                    </details>
                  </div>
                </details>
              );
            })}
            {history.length < historyTotal && (
              <button
                onClick={loadMoreHistory}
                disabled={historyLoadingMore}
                className="w-full text-sm text-gray-400 hover:text-white border border-zinc-700 px-3 py-2 rounded transition-colors disabled:opacity-50"
              >
                {historyLoadingMore ? 'Loading...' : `Load more (${history.length} of ${historyTotal})`}
              </button>
            )}
          </div>
        )}

        {/* Pre-Chat: Metrics Pane */}
        <div className="space-y-5 mb-5">
            {/* Once a session starts, metrics collapse behind this header */}
            {sessionStarted && (
              <button
                onClick={() => setMetricsCollapsed(c => !c)}
                className="w-full flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <span>Today&apos;s data{metrics?.recovery_status ? ` · ${metrics.recovery_status}` : ''}</span>
                <span className={`text-xs transition-transform ${metricsCollapsed ? '' : 'rotate-180'}`}>▼</span>
              </button>
            )}

            {/* Metrics Grid */}
            {(!sessionStarted || !metricsCollapsed) && (metricsLoading ? (
              <div className="text-gray-500 text-sm">Loading health data...</div>
            ) : metrics ? (
              <div className="space-y-3">
                {/* Recovery Status — the primary signal */}
                {metrics.recovery_status && (
                  <div className={`border rounded-lg px-4 py-3 ${
                    metrics.recovery_status.startsWith('Ready to push') ? 'bg-green-950 border-green-800' :
                    metrics.recovery_status.startsWith('Ready') ? 'bg-emerald-950 border-emerald-800' :
                    metrics.recovery_status.startsWith('Easy') ? 'bg-yellow-950 border-yellow-800' :
                    metrics.recovery_status.startsWith('Recovery') ? 'bg-orange-950 border-orange-800' :
                    'bg-red-950 border-red-800'
                  }`}>
                    <div className="text-xs text-gray-400">Today&apos;s Status</div>
                    <div className="text-lg font-semibold text-white">{metrics.recovery_status}</div>
                  </div>
                )}

                {/* Sleep — actual durations */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500 mb-1">Sleep</div>
                  <div className="grid grid-cols-3 gap-3">
                    <Link href="/coach/metric/sleep-total" className="hover:opacity-80 transition-opacity">
                      <div className="text-lg font-semibold text-white">
                        {metrics.sleep_total ? formatMinutes(metrics.sleep_total) : '—'}
                        <TrendArrow trend={trends['sleep-total']} />
                      </div>
                      <div className="text-xs text-gray-500">total</div>
                      {sparklines['sleep-total'] && <Sparkline data={sparklines['sleep-total']} />}
                    </Link>
                    <Link href="/coach/metric/deep-sleep" className="hover:opacity-80 transition-opacity">
                      <div className="text-lg font-semibold text-white">
                        {metrics.deep_sleep_min ? formatMinutes(metrics.deep_sleep_min) : '—'}
                        <TrendArrow trend={trends['deep-sleep']} />
                      </div>
                      <div className="text-xs text-gray-500">deep</div>
                      {sparklines['deep-sleep'] && <Sparkline data={sparklines['deep-sleep']} />}
                    </Link>
                    <Link href="/coach/metric/rem-sleep" className="hover:opacity-80 transition-opacity">
                      <div className="text-lg font-semibold text-white">
                        {metrics.rem_sleep_min ? formatMinutes(metrics.rem_sleep_min) : '—'}
                        <TrendArrow trend={trends['rem-sleep']} />
                      </div>
                      <div className="text-xs text-gray-500">REM</div>
                      {sparklines['rem-sleep'] && <Sparkline data={sparklines['rem-sleep']} />}
                    </Link>
                  </div>
                </div>

                {/* Physiology row */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  <MetricCard label="HRV" value={metrics.hrv} unit="ms" trend={trends['hrv']} sparkline={sparklines['hrv']} href="/coach/metric/hrv" />
                  <MetricCard label="Resting HR" value={metrics.resting_hr} unit="bpm" trend={trends['resting-hr']} sparkline={sparklines['resting-hr']} href="/coach/metric/resting-hr" />
                  <MetricCard label="Blood Oxygen" value={metrics.spo2 ? Math.round(metrics.spo2) : null} unit="%" trend={trends['spo2']} sparkline={sparklines['spo2']} href="/coach/metric/spo2" />
                  <MetricCard label="CV Age" value={metrics.cv_age} unit="yr" trend={trends['cv-age']} sparkline={sparklines['cv-age']} href="/coach/metric/cv-age" />
                  <MetricCard label="Weight" value={metrics.weight} unit="lbs" warn={metrics.weight_stale} trend={trends['weight']} sparkline={sparklines['weight']} href="/coach/metric/weight" />
                </div>

                {/* Resilience / Stress-Recovery */}
                {(metrics.stress_min != null && metrics.restored_min != null) && (
                  <div className={`bg-zinc-900 border rounded-lg px-3 py-2 ${
                    metrics.resilience?.includes('High recovery') ? 'border-green-800' :
                    metrics.resilience?.includes('Balanced') ? 'border-zinc-700' :
                    metrics.resilience?.includes('Elevated') ? 'border-yellow-700' :
                    metrics.resilience?.includes('High stress') ? 'border-red-800' :
                    'border-zinc-800'
                  }`}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <div className="text-xs text-gray-500">Resilience</div>
                        <div className="text-sm font-medium text-white">{metrics.resilience || 'No stress data yet'}</div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <span>{metrics.stress_min}m stressed</span>
                        <span> · </span>
                        <span>{metrics.restored_min}m restored</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Yesterday's Activities */}
                {metrics.yesterday_activities && metrics.yesterday_activities.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500 mb-1">Yesterday&apos;s Activities</div>
                    <div className="space-y-1">
                      {metrics.yesterday_activities.map((a, i) => <ActivityRow key={i} activity={a} />)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No health data available. Oura may need to sync.</div>
            ))}

            {!sessionStarted && (<>
            {/* Manual Inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="e.g. 192"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Back Pain: {backPain}/10</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={backPain}
                    onChange={e => setBackPain(parseInt(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              </div>

              <details className="text-sm">
                <summary className="text-gray-500 cursor-pointer text-xs">More inputs</summary>
                <div className="space-y-3 mt-2">
                  <input
                    type="text"
                    value={backNotes}
                    onChange={e => setBackNotes(e.target.value)}
                    placeholder="Back mobility notes"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  />
                  <input
                    type="text"
                    value={bowel}
                    onChange={e => setBowel(e.target.value)}
                    placeholder="Bowel status"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  />
                  <textarea
                    value={injuries}
                    onChange={e => setInjuries(e.target.value)}
                    placeholder="Injuries or notes for today"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </details>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={startSession}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium py-3 rounded transition-colors"
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
            </>)}
        </div>

        {/* Chat */}
        {sessionStarted && (
          <div className="space-y-3">
            {/* Collapsed metrics summary during chat */}
            <details className="text-xs">
              <summary className="text-gray-500 cursor-pointer">Today&apos;s data</summary>
              <div className="mt-1 text-gray-500 whitespace-pre-wrap bg-zinc-950 rounded p-2">{dataInjection}</div>
            </details>

            {/* Messages — skip the first user message (data injection) */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {messages.slice(1).map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm rounded p-3 ${
                    msg.role === 'assistant'
                      ? 'bg-zinc-900 border border-zinc-800 text-gray-200'
                      : 'bg-zinc-950 text-gray-300'
                  }`}
                >
                  {msg.role === 'assistant' && <span className="text-xs text-gray-500 block mb-1">Coach</span>}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input or Saved */}
            {finalized ? (
              <div className="text-center py-3 space-y-2">
                <p className="text-green-400 text-sm">Session saved.</p>
                {savedSummary && <p className="text-gray-400 text-xs">{savedSummary}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={turnCount >= 3 ? 'Last chance to clarify...' : 'Ask a follow-up...'}
                    disabled={loading}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    Send
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">
                    Turn {turnCount}
                  </span>
                  <button
                    onClick={saveSession}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white text-sm px-4 py-1.5 rounded transition-colors"
                  >
                    Save Session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
