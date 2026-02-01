/**
 * Suggestions page - Track feature ideas and improvements
 * Submit ideas anytime, review with Claude at session start
 */

'use client';

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

interface Suggestion {
  id: string;
  content: string;
  status: 'pending' | 'considering' | 'done' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  outcome: string | null;
}

export default function SuggestionsPage() {
  const [suggestions, set_suggestions] = useState<Suggestion[]>([]);
  const [new_content, set_new_content] = useState('');
  const [filter, set_filter] = useState<string>('all');
  const [loading, set_loading] = useState(true);
  const [submitting, set_submitting] = useState(false);
  const [is_localhost, set_is_localhost] = useState(false);
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [edit_outcome, set_edit_outcome] = useState('');

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
    fetch_suggestions();
  }, []);

  async function fetch_suggestions() {
    try {
      // Always fetch from production to see centralized suggestions
      const base_url = is_localhost
        ? 'https://8i11.vercel.app'
        : '';
      const url = filter === 'all'
        ? `${base_url}/api/suggestions`
        : `${base_url}/api/suggestions?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        set_suggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      set_loading(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      fetch_suggestions();
    }
  }, [filter]);

  async function handle_submit(e: React.FormEvent) {
    e.preventDefault();
    if (!new_content.trim() || submitting) return;

    set_submitting(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: new_content.trim() })
      });
      const data = await res.json();
      if (data.success) {
        set_new_content('');
        fetch_suggestions();
      }
    } catch (error) {
      console.error('Failed to create suggestion:', error);
    } finally {
      set_submitting(false);
    }
  }

  async function update_status(id: string, status: Suggestion['status'], outcome?: string) {
    try {
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, outcome })
      });
      const data = await res.json();
      if (data.success) {
        set_editing_id(null);
        set_edit_outcome('');
        fetch_suggestions();
      }
    } catch (error) {
      console.error('Failed to update suggestion:', error);
    }
  }

  async function delete_suggestion(id: string) {
    if (!confirm('Delete this suggestion?')) return;

    try {
      const res = await fetch(`/api/suggestions?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetch_suggestions();
      }
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
    }
  }

  function format_date(date_str: string): string {
    const date = new Date(date_str);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function status_badge(status: Suggestion['status']) {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      considering: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      done: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded border ${colors[status]}`}>
        {status}
      </span>
    );
  }

  const pending_count = suggestions.filter(s => s.status === 'pending').length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-4xl mx-auto p-6">
        <NavTabs is_localhost={is_localhost} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-cyan-400 mb-2">
            Suggestions
            {pending_count > 0 && (
              <span className="ml-3 text-sm font-normal text-yellow-400">
                {pending_count} pending
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm">
            Capture feature ideas anytime. Claude checks for new items at session start.
          </p>
        </div>

        {/* New suggestion form - only on production */}
        {is_localhost ? (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              Suggestions are stored in the production database.{' '}
              <a
                href="https://8i11.vercel.app/tools/suggestions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-300"
              >
                Add suggestions on the live site →
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={handle_submit} className="mb-8">
            <div className="flex gap-3">
              <input
                type="text"
                value={new_content}
                onChange={(e) => set_new_content(e.target.value)}
                placeholder="Add a new suggestion or idea..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
              />
              <button
                type="submit"
                disabled={!new_content.trim() || submitting}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
              >
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'considering', 'done', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => set_filter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                filter === f
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:border-cyan-500/30'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Suggestions list */}
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : suggestions.length === 0 ? (
          <div className="text-center text-gray-500 py-12 border border-white/10 rounded-lg">
            {filter === 'all'
              ? 'No suggestions yet. Add one above!'
              : `No ${filter} suggestions.`}
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {status_badge(s.status)}
                      <span className="text-xs text-gray-500">
                        {format_date(s.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-200">{s.content}</p>
                    {s.outcome && (
                      <p className="mt-2 text-sm text-gray-400 italic">
                        Outcome: {s.outcome}
                      </p>
                    )}
                  </div>

                  {/* Actions - only on production */}
                  {!is_localhost && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.status === 'pending' && (
                        <>
                          <button
                            onClick={() => update_status(s.id, 'considering')}
                            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-all"
                          >
                            Considering
                          </button>
                          <button
                            onClick={() => {
                              set_editing_id(s.id);
                              set_edit_outcome('');
                            }}
                            className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => update_status(s.id, 'rejected')}
                            className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {s.status === 'considering' && (
                        <>
                          <button
                            onClick={() => {
                              set_editing_id(s.id);
                              set_edit_outcome('');
                            }}
                            className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => update_status(s.id, 'rejected')}
                            className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => delete_suggestion(s.id)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-red-400 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Outcome input modal - only on production */}
                {!is_localhost && editing_id === s.id && (
                  <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <label className="block text-sm text-gray-400 mb-2">
                      What was the outcome? (optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={edit_outcome}
                        onChange={(e) => set_edit_outcome(e.target.value)}
                        placeholder="e.g., Implemented in session 14"
                        className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
                      />
                      <button
                        onClick={() => update_status(s.id, 'done', edit_outcome)}
                        className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 rounded transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          set_editing_id(null);
                          set_edit_outcome('');
                        }}
                        className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* API info for Claude */}
        <div className="mt-12 p-4 bg-white/5 border border-white/10 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 mb-2">For Claude Code</h3>
          <code className="text-xs text-cyan-400">
            GET /api/suggestions?status=pending
          </code>
          <p className="text-xs text-gray-500 mt-1">
            Check this endpoint at session start for new ideas to discuss.
          </p>
        </div>
      </div>
    </main>
  );
}
