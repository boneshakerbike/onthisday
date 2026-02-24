/**
 * Usage Dashboard - Anthropic API token tracking
 * Admin-only view of API consumption and estimated costs
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import NavTabs from '@/components/nav_tabs';

interface ModelBreakdown {
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

interface RouteBreakdown {
  route: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

interface Summary {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  by_model: ModelBreakdown[];
  by_route: RouteBreakdown[];
  failures: number;
  partials: number;
}

interface PricingEntry {
  model: string;
  input_cost_per_mtok: number;
  output_cost_per_mtok: number;
  cache_read_cost_per_mtok: number;
  cache_creation_cost_per_mtok: number;
  effective_date: string;
}

interface LogEntry {
  id: string;
  provider_id: string | null;
  timestamp: string;
  agent_id: string | null;
  route: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  status: 'success' | 'partial' | 'failure';
  retries: number;
  error_message: string | null;
}

function format_tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function short_model(model: string): string {
  if (model.includes('opus')) return 'Opus 4.5';
  if (model.includes('sonnet')) return 'Sonnet 4';
  if (model.includes('haiku')) return 'Haiku 4.5';
  return model;
}

function estimate_cost(summary: Summary, pricing: PricingEntry[]): number {
  let cost = 0;
  for (const m of summary.by_model) {
    const p = pricing.find(pr => pr.model === m.model);
    if (!p) continue;
    cost += (m.input_tokens / 1_000_000) * p.input_cost_per_mtok;
    cost += (m.output_tokens / 1_000_000) * p.output_cost_per_mtok;
    cost += (m.cache_read_input_tokens / 1_000_000) * p.cache_read_cost_per_mtok;
    cost += (m.cache_creation_input_tokens / 1_000_000) * p.cache_creation_cost_per_mtok;
  }
  return cost;
}

export default function UsagePage() {
  const [rolling_24h, set_rolling_24h] = useState<Summary | null>(null);
  const [calendar_month, set_calendar_month] = useState<Summary | null>(null);
  const [pricing, set_pricing] = useState<PricingEntry[]>([]);
  const [logs, set_logs] = useState<LogEntry[]>([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  const [audit_open, set_audit_open] = useState(false);
  const [audit_filter, set_audit_filter] = useState('all');

  const load_summary = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.status === 403) { set_error('Admin access required'); set_loading(false); return; }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      set_rolling_24h(data.rolling_24h);
      set_calendar_month(data.calendar_month);
      set_pricing(data.pricing);
    } catch {
      set_error('Failed to load usage data');
    }
    set_loading(false);
  }, []);

  const load_logs = useCallback(async () => {
    const params = new URLSearchParams({ view: 'logs', limit: '100' });
    if (audit_filter !== 'all') params.set('status', audit_filter);
    const res = await fetch(`/api/usage?${params}`);
    if (res.ok) {
      const data = await res.json();
      set_logs(data.logs);
    }
  }, [audit_filter]);

  useEffect(() => { load_summary(); }, [load_summary]);
  useEffect(() => { if (audit_open) load_logs(); }, [audit_open, load_logs]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
        <div className="max-w-4xl mx-auto p-6">
          <NavTabs />
          <h1 className="text-2xl font-bold text-cyan-400 mb-4">Usage Dashboard</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
        <div className="max-w-4xl mx-auto p-6">
          <NavTabs />
          <h1 className="text-2xl font-bold text-cyan-400 mb-4">Usage Dashboard</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  const cost_24h = rolling_24h ? estimate_cost(rolling_24h, pricing) : 0;
  const cost_month = calendar_month ? estimate_cost(calendar_month, pricing) : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-4xl mx-auto p-6">
        <NavTabs />

        <h1 className="text-2xl font-bold text-cyan-400 mb-6">Usage Dashboard</h1>

        {/* Rolling 24h Summary */}
        {rolling_24h && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-300 mb-3">Last 24 Hours</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="API Calls" value={String(rolling_24h.total_calls)} />
              <StatCard label="Input Tokens" value={format_tokens(rolling_24h.total_input_tokens)} />
              <StatCard label="Output Tokens" value={format_tokens(rolling_24h.total_output_tokens)} />
              <StatCard label="Est. Cost" value={`$${cost_24h.toFixed(4)}`} accent />
            </div>

            {rolling_24h.by_model.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {rolling_24h.by_model.map(m => (
                  <div key={m.model} className="px-3 py-1.5 text-xs rounded bg-white/5 border border-white/10">
                    <span className="text-cyan-400">{short_model(m.model)}</span>
                    <span className="text-gray-400 ml-2">{m.calls} calls</span>
                    <span className="text-gray-500 ml-2">{format_tokens(m.input_tokens + m.output_tokens)} tok</span>
                  </div>
                ))}
              </div>
            )}

            {(rolling_24h.failures > 0 || rolling_24h.partials > 0) && (
              <div className="flex gap-3 mt-2 text-xs">
                {rolling_24h.failures > 0 && (
                  <span className="text-red-400">{rolling_24h.failures} failed</span>
                )}
                {rolling_24h.partials > 0 && (
                  <span className="text-yellow-400">{rolling_24h.partials} partial</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Calendar Month */}
        {calendar_month && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-300 mb-3">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Denver' })}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="API Calls" value={String(calendar_month.total_calls)} />
              <StatCard label="Input Tokens" value={format_tokens(calendar_month.total_input_tokens)} />
              <StatCard label="Output Tokens" value={format_tokens(calendar_month.total_output_tokens)} />
              <StatCard label="Est. Cost" value={`$${cost_month.toFixed(4)}`} accent />
            </div>

            {calendar_month.by_route.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b border-white/10 text-gray-400">
                      <th className="py-1 pr-3">Route</th>
                      <th className="py-1 pr-3">Calls</th>
                      <th className="py-1 pr-3">Input</th>
                      <th className="py-1">Output</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {calendar_month.by_route.map(r => (
                      <tr key={r.route} className="border-b border-white/5">
                        <td className="py-1 pr-3 font-mono text-cyan-400/70">{r.route}</td>
                        <td className="py-1 pr-3">{r.calls}</td>
                        <td className="py-1 pr-3">{format_tokens(r.input_tokens)}</td>
                        <td className="py-1">{format_tokens(r.output_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Panel */}
        <div className="mb-6 border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => set_audit_open(!audit_open)}
            className="w-full px-4 py-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-all text-left"
          >
            <span className="font-medium">Audit Log</span>
            <svg
              className={`w-5 h-5 transition-transform ${audit_open ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {audit_open && (
            <div className="px-4 py-4">
              <div className="flex gap-2 mb-3">
                {['all', 'success', 'partial', 'failure'].map(f => (
                  <button
                    key={f}
                    onClick={() => set_audit_filter(f)}
                    className={`px-2 py-1 text-xs rounded ${
                      audit_filter === f
                        ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {logs.length === 0 ? (
                <p className="text-gray-500 text-sm">No logs found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-white/10 text-gray-400">
                        <th className="py-1 pr-2">Time</th>
                        <th className="py-1 pr-2">Route</th>
                        <th className="py-1 pr-2">Model</th>
                        <th className="py-1 pr-2">In</th>
                        <th className="py-1 pr-2">Out</th>
                        <th className="py-1 pr-2">Status</th>
                        <th className="py-1">Error</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {logs.map(log => (
                        <tr
                          key={log.id}
                          className={`border-b border-white/5 ${
                            log.status === 'failure' ? 'bg-red-500/5' :
                            log.status === 'partial' ? 'bg-yellow-500/5' : ''
                          }`}
                        >
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-US', {
                              timeZone: 'America/Denver',
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="py-1 pr-2 font-mono text-cyan-400/70">{log.route}</td>
                          <td className="py-1 pr-2">{short_model(log.model)}</td>
                          <td className="py-1 pr-2">{format_tokens(log.input_tokens)}</td>
                          <td className="py-1 pr-2">{format_tokens(log.output_tokens)}</td>
                          <td className={`py-1 pr-2 ${
                            log.status === 'failure' ? 'text-red-400' :
                            log.status === 'partial' ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                            {log.status}{log.retries > 0 ? ` (${log.retries}r)` : ''}
                          </td>
                          <td className="py-1 text-gray-500 truncate max-w-[200px]">
                            {log.error_message || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pricing Reference */}
        {pricing.length > 0 && (
          <div className="text-xs text-gray-500 border-t border-white/5 pt-3">
            <p className="mb-1">Pricing reference (per 1M tokens):</p>
            <div className="flex flex-wrap gap-3">
              {pricing.map(p => (
                <span key={p.model}>
                  <span className="text-gray-400">{short_model(p.model)}</span>: ${p.input_cost_per_mtok} in / ${p.output_cost_per_mtok} out
                  <span className="text-gray-600 ml-1">(as of {p.effective_date})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-cyan-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}
