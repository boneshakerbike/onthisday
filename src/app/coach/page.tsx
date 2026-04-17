/**
 * /coach — Daily AI Health Coaching
 * Manual inputs + data review + multi-turn coaching chat + finalize
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import NavTabs from '@/components/nav_tabs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UsageStats {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

interface HistorySession {
  date: number;
  advice_full: string;
  advice_summary: string | null;
  conversation_turns: number;
}

export default function CoachPage() {
  useEffect(() => { document.title = '8i11 | Coach'; }, []);

  // Manual inputs
  const [weight, setWeight] = useState('');
  const [backPain, setBackPain] = useState(0);
  const [backNotes, setBackNotes] = useState('');
  const [bowel, setBowel] = useState('');
  const [injuries, setInjuries] = useState('');

  // History
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const epochDay = Math.floor(Date.now() / 86400000);

  async function startSession() {
    setLoading(true);
    setError('');

    try {
      // Fetch live Oura data (cache doesn't store today's data)
      let oura_snapshot = null;
      try {
        const ouraRes = await fetch(`/api/oura/data?date=${dateStr}`);
        if (ouraRes.ok) {
          const ouraData = await ouraRes.json();
          if (ouraData.success) oura_snapshot = ouraData;
        }
      } catch { /* Oura fetch is best-effort */ }

      // Fetch COROS data (try today, fall back to yesterday)
      let coros_snapshot = null;
      try {
        const corosRes = await fetch(`/api/coros/data?date=${dateStr}`);
        if (corosRes.ok) {
          coros_snapshot = await corosRes.json();
        } else {
          const y = new Date(today);
          y.setDate(y.getDate() - 1);
          const yStr = y.toLocaleDateString('en-CA');
          const corosY = await fetch(`/api/coros/data?date=${yStr}`);
          if (corosY.ok) coros_snapshot = await corosY.json();
        }
      } catch { /* COROS fetch is best-effort */ }

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
          oura_live: oura_snapshot,
          coros_live: coros_snapshot,
        }),
      });

      if (!injectRes.ok) throw new Error('Failed to build health data');
      const { injection } = await injectRes.json();

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
      const usage = data.usage as UsageStats;
      setTotalTokens(usage.input_tokens + usage.output_tokens);

      setMessages([
        { role: 'user', content: injection },
        { role: 'assistant', content: data.response },
      ]);
      setSessionStarted(true);
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
      const usage = data.usage as UsageStats;
      setTotalTokens(prev => prev + usage.input_tokens + usage.output_tokens);

      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  async function finalizeSession() {
    setLoading(true);
    setError('');

    try {
      // Combine all assistant responses as the full advice
      const adviceFull = messages
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .join('\n\n---\n\n');

      const res = await fetch('/api/coaching/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: epochDay,
          date_str: dateStr,
          advice_full: adviceFull,
          conversation_turns: Math.floor(messages.length / 2),
          token_count: totalTokens,
          manual: {
            weight_lbs: weight ? parseFloat(weight) : undefined,
            back_pain_scale: backPain,
            back_mobility_notes: backNotes || undefined,
            bowel_status: bowel || undefined,
            injury_notes: injuries || undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Finalize failed');
      }

      setFinalized(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finalize');
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
      const res = await fetch('/api/coaching/history?limit=30');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.sessions);
        setHistoryLoaded(true);
        setShowHistory(true);
      }
    } catch { /* best effort */ }
  }

  function epochDayToDate(epoch: number): string {
    return new Date(epoch * 86400000).toISOString().split('T')[0];
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <NavTabs />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Daily Coach</h1>
          <button
            onClick={loadHistory}
            className="text-sm text-gray-400 hover:text-white border border-zinc-700 px-3 py-1 rounded transition-colors"
          >
            {showHistory ? 'Hide History' : 'Past Sessions'}
          </button>
        </div>

        {showHistory && history.length > 0 && (
          <div className="mb-6 space-y-3">
            {history.map(s => (
              <details key={s.date} className="bg-zinc-900 border border-zinc-800 rounded">
                <summary className="px-4 py-2 cursor-pointer text-sm text-gray-300 hover:text-white">
                  {epochDayToDate(s.date)} — {s.conversation_turns} turns
                </summary>
                <div className="px-4 pb-3 text-sm text-gray-400 whitespace-pre-wrap">
                  {s.advice_summary || s.advice_full}
                </div>
              </details>
            ))}
          </div>
        )}

        {showHistory && history.length === 0 && (
          <p className="text-gray-500 text-sm mb-6">No past sessions yet.</p>
        )}

        {!sessionStarted ? (
          <div className="space-y-6">
            <p className="text-gray-400 text-sm">
              {dateStr} — Enter your manual data, then start your coaching session.
            </p>

            {/* Manual Input Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="e.g. 178"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Back Pain: {backPain}/10
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={backPain}
                  onChange={e => setBackPain(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>None</span>
                  <span>Severe</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Back Mobility Notes</label>
                <input
                  type="text"
                  value={backNotes}
                  onChange={e => setBackNotes(e.target.value)}
                  placeholder="e.g. full mobility, stiff on left side"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>

              <details className="text-sm">
                <summary className="text-gray-400 cursor-pointer">Optional fields</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bowel Status</label>
                    <input
                      type="text"
                      value={bowel}
                      onChange={e => setBowel(e.target.value)}
                      placeholder="e.g. normal, loose"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Injuries / Notes</label>
                    <textarea
                      value={injuries}
                      onChange={e => setInjuries(e.target.value)}
                      placeholder="Any injuries, symptoms, or notes"
                      rows={2}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </details>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={startSession}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium py-3 rounded transition-colors"
            >
              {loading ? 'Loading health data...' : 'Start Coaching Session'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chat Messages */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm whitespace-pre-wrap ${
                    msg.role === 'assistant'
                      ? 'bg-zinc-900 border border-zinc-800 rounded p-4'
                      : i === 0
                        ? 'text-gray-500 bg-zinc-950 rounded p-3 text-xs'
                        : 'text-gray-300 bg-zinc-950 rounded p-3'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <span className="text-xs text-gray-500 block mb-2">Coach</span>
                  )}
                  {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input or Finalized */}
            {finalized ? (
              <div className="text-center py-4">
                <p className="text-green-400 text-sm">Session saved.</p>
                <p className="text-gray-500 text-xs mt-1">
                  {Math.floor(messages.length / 2)} turns, {totalTokens.toLocaleString()} tokens
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {error && <p className="text-red-400 text-sm">{error}</p>}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Ask a follow-up..."
                    disabled={loading}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Send
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {Math.floor(messages.length / 2)} turns, {totalTokens.toLocaleString()} tokens
                  </span>
                  <button
                    onClick={finalizeSession}
                    disabled={loading}
                    className="text-sm text-gray-400 hover:text-white border border-zinc-700 px-3 py-1 rounded transition-colors"
                  >
                    Finalize Session
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
