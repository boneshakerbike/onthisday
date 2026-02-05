/**
 * Prompt Library - Store, version, and refine prompts with AI review
 * Google Docs-style versioning: every save creates a version
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import NavTabs from '@/components/nav_tabs';

interface Prompt {
  id: string;
  name: string;
  current_content: string;
  version_count: number;
  created_at: string;
  updated_at: string;
}

interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string;
  note: string | null;
  created_at: string;
}

interface ReviewResult {
  suggestions: string;
  improved_prompt: string;
  usage: { input_tokens: number; output_tokens: number };
}

type View = 'list' | 'editor';

export default function PromptLibraryPage() {
  const [is_localhost, set_is_localhost] = useState(false);
  const [view, set_view] = useState<View>('list');
  const [prompts, set_prompts] = useState<Prompt[]>([]);
  const [loading, set_loading] = useState(true);

  // Editor state
  const [active_prompt, set_active_prompt] = useState<Prompt | null>(null);
  const [versions, set_versions] = useState<PromptVersion[]>([]);
  const [editor_content, set_editor_content] = useState('');
  const [save_note, set_save_note] = useState('');
  const [saving, set_saving] = useState(false);
  const [show_history, set_show_history] = useState(false);
  const [viewing_version, set_viewing_version] = useState<PromptVersion | null>(null);

  // Review state
  const [review_result, set_review_result] = useState<ReviewResult | null>(null);
  const [reviewing, set_reviewing] = useState(false);

  // Trim state
  const [trim_dismissed, set_trim_dismissed] = useState(false);

  // New prompt state
  const [creating, set_creating] = useState(false);
  const [new_name, set_new_name] = useState('');

  // Rename state
  const [renaming, set_renaming] = useState(false);
  const [rename_value, set_rename_value] = useState('');

  const base_url = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'https://8i11.vercel.app'
    : '';

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
    fetch_prompts();
  }, []);

  async function fetch_prompts() {
    try {
      const res = await fetch(`${base_url}/api/prompts`);
      const data = await res.json();
      if (data.success) {
        set_prompts(data.prompts);
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    } finally {
      set_loading(false);
    }
  }

  async function open_prompt(id: string) {
    try {
      const res = await fetch(`${base_url}/api/prompts?id=${id}`);
      const data = await res.json();
      if (data.success) {
        set_active_prompt(data.prompt);
        set_versions(data.versions);
        set_editor_content(data.prompt.current_content);
        set_view('editor');
        set_review_result(null);
        set_show_history(false);
        set_viewing_version(null);
        set_trim_dismissed(false);
        set_save_note('');
      }
    } catch (error) {
      console.error('Failed to open prompt:', error);
    }
  }

  async function handle_create() {
    if (!new_name.trim()) return;

    try {
      const res = await fetch(`${base_url}/api/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: new_name.trim(), content: '' })
      });
      const data = await res.json();
      if (data.success) {
        set_creating(false);
        set_new_name('');
        await open_prompt(data.id);
        await fetch_prompts();
      }
    } catch (error) {
      console.error('Failed to create prompt:', error);
    }
  }

  async function handle_save() {
    if (!active_prompt || saving) return;

    set_saving(true);
    try {
      const res = await fetch(`${base_url}/api/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: active_prompt.id,
          action: 'save',
          content: editor_content,
          note: save_note.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        set_save_note('');
        // Refresh prompt and versions
        await open_prompt(active_prompt.id);
        await fetch_prompts();
      }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      set_saving(false);
    }
  }

  async function handle_rename() {
    if (!active_prompt || !rename_value.trim()) return;

    try {
      const res = await fetch(`${base_url}/api/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: active_prompt.id, action: 'rename', name: rename_value.trim() })
      });
      const data = await res.json();
      if (data.success) {
        set_renaming(false);
        set_active_prompt({ ...active_prompt, name: rename_value.trim() });
        fetch_prompts();
      }
    } catch (error) {
      console.error('Failed to rename:', error);
    }
  }

  async function handle_delete() {
    if (!active_prompt || !confirm('Delete this prompt and all its versions?')) return;

    try {
      const res = await fetch(`${base_url}/api/prompts?id=${active_prompt.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        set_view('list');
        set_active_prompt(null);
        fetch_prompts();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  async function handle_review() {
    if (!active_prompt || reviewing) return;

    set_reviewing(true);
    set_review_result(null);
    try {
      const res = await fetch(`${base_url}/api/prompts/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor_content })
      });
      const data = await res.json();
      if (data.success) {
        set_review_result({
          suggestions: data.suggestions,
          improved_prompt: data.improved_prompt,
          usage: data.usage
        });
      } else {
        alert(data.error || 'Review failed');
      }
    } catch (error) {
      console.error('Failed to review:', error);
    } finally {
      set_reviewing(false);
    }
  }

  async function handle_trim() {
    if (!active_prompt) return;

    try {
      const res = await fetch(`${base_url}/api/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: active_prompt.id, action: 'trim', keep_count: 5 })
      });
      const data = await res.json();
      if (data.success) {
        await open_prompt(active_prompt.id);
        await fetch_prompts();
      }
    } catch (error) {
      console.error('Failed to trim:', error);
    }
  }

  function handle_restore(version: PromptVersion) {
    set_editor_content(version.content);
    set_viewing_version(null);
    set_save_note(`Restored from v${version.version_number}`);
  }

  const has_unsaved = active_prompt && editor_content !== active_prompt.current_content;

  function handle_back() {
    if (has_unsaved && !confirm('You have unsaved changes. Discard them?')) return;
    set_view('list');
    set_active_prompt(null);
    set_review_result(null);
  }

  function relative_time(date_str: string): string {
    const now = Date.now();
    const then = new Date(date_str).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date_str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function format_date(date_str: string): string {
    return new Date(date_str).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function cost_display(usage: { input_tokens: number; output_tokens: number }): string {
    const cost = (usage.input_tokens * 3 / 1_000_000) + (usage.output_tokens * 15 / 1_000_000);
    return `$${cost.toFixed(3)}`;
  }

  // ── List View ──────────────────────────────────────────────

  function render_list() {
    return (
      <>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 mb-2">Prompt Library</h1>
            <p className="text-gray-400 text-sm">Store, version, and refine your prompts with AI review.</p>
          </div>
          {!creating && (
            <button
              onClick={() => set_creating(true)}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-all text-sm"
            >
              + New Prompt
            </button>
          )}
        </div>

        {creating && (
          <div className="mb-6 p-4 bg-white/5 border border-cyan-400/30 rounded-lg">
            <label className="block text-sm text-gray-400 mb-2">Prompt name</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={new_name}
                onChange={(e) => set_new_name(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handle_create(); if (e.key === 'Escape') set_creating(false); }}
                placeholder="e.g., Story Generation System Prompt"
                className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
              />
              <button onClick={handle_create} className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 rounded transition-all">Create</button>
              <button onClick={() => { set_creating(false); set_new_name(''); }} className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded transition-all">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : prompts.length === 0 ? (
          <div className="text-center text-gray-500 py-12 border border-white/10 rounded-lg">
            No prompts yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {prompts.map(p => (
              <button
                key={p.id}
                onClick={() => open_prompt(p.id)}
                className="w-full text-left p-4 bg-white/5 border border-white/10 rounded-lg hover:border-cyan-400/30 hover:bg-white/[0.07] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-200 truncate">{p.name}</span>
                      {p.version_count >= 10 && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Consider trimming versions" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>v{p.version_count}</span>
                      <span>Updated {relative_time(p.updated_at)}</span>
                    </div>
                  </div>
                  <span className="text-gray-500 group-hover:text-cyan-400 transition-all text-sm">Open &rarr;</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Editor View ────────────────────────────────────────────

  function render_editor() {
    if (!active_prompt) return null;

    return (
      <>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={handle_back} className="text-gray-400 hover:text-cyan-400 transition-all text-sm">
            &larr; Library
          </button>
          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={rename_value}
                  onChange={(e) => set_rename_value(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handle_rename(); if (e.key === 'Escape') set_renaming(false); }}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1 text-white focus:outline-none focus:border-cyan-400/50"
                />
                <button onClick={handle_rename} className="px-3 py-1 text-xs bg-cyan-500 rounded">Save</button>
                <button onClick={() => set_renaming(false)} className="px-3 py-1 text-xs bg-white/10 rounded">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { set_renaming(true); set_rename_value(active_prompt.name); }}
                className="text-lg font-medium text-gray-200 hover:text-cyan-400 transition-all truncate block"
                title="Click to rename"
              >
                {active_prompt.name}
              </button>
            )}
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">v{active_prompt.version_count}</span>
        </div>

        {/* Editor */}
        {viewing_version ? (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-400">
                Viewing v{viewing_version.version_number}
                {viewing_version.note && ` - "${viewing_version.note}"`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handle_restore(viewing_version)}
                  className="px-3 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 rounded transition-all"
                >
                  Restore this version
                </button>
                <button
                  onClick={() => set_viewing_version(null)}
                  className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-all"
                >
                  Back to current
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={viewing_version.content}
              className="w-full h-[400px] bg-white/5 border border-amber-400/30 rounded-lg px-4 py-3 text-gray-300 font-mono text-sm resize-y focus:outline-none"
            />
          </div>
        ) : (
          <div className="mb-4">
            <textarea
              value={editor_content}
              onChange={(e) => set_editor_content(e.target.value)}
              placeholder="Write your prompt here..."
              className="w-full h-[400px] bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-gray-200 font-mono text-sm resize-y focus:outline-none focus:border-cyan-400/30"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">{editor_content.length.toLocaleString()} characters</span>
              {has_unsaved && <span className="text-xs text-amber-400">Unsaved changes</span>}
            </div>
          </div>
        )}

        {/* Action bar */}
        {!viewing_version && (
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-2">
              <input
                value={save_note}
                onChange={(e) => set_save_note(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handle_save(); }}
                placeholder="Save note (optional)"
                className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handle_save}
                disabled={saving || !has_unsaved}
                className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-all"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handle_review}
                disabled={reviewing || !editor_content.trim()}
                className="px-4 py-2 text-sm bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-all border border-purple-500/30"
              >
                {reviewing ? 'Reviewing...' : 'Review with Sonnet ~3\u00a2'}
              </button>
              <button
                onClick={() => set_show_history(!show_history)}
                className={`px-4 py-2 text-sm rounded transition-all border ${show_history ? 'bg-white/10 border-cyan-400/30 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'}`}
              >
                History ({active_prompt.version_count})
              </button>
              <button
                onClick={handle_delete}
                className="px-4 py-2 text-sm text-gray-500 hover:text-red-400 transition-all ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Trim nudge */}
        {active_prompt.version_count >= 10 && !trim_dismissed && !viewing_version && (
          <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
            <span className="text-sm text-amber-400">
              You have {active_prompt.version_count} versions. Consider trimming to keep things tidy.
            </span>
            <div className="flex gap-2 flex-shrink-0 ml-4">
              <button
                onClick={handle_trim}
                className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded transition-all"
              >
                Keep latest 5
              </button>
              <button
                onClick={() => set_trim_dismissed(true)}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-300 transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Version history */}
        {show_history && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Version History</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {versions.map(v => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-300">v{v.version_number}</span>
                      {v.version_number === active_prompt.version_count && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded">Current</span>
                      )}
                      {v.note && <span className="text-xs text-gray-500 truncate">{v.note}</span>}
                    </div>
                    <span className="text-xs text-gray-500">{format_date(v.created_at)}</span>
                  </div>
                  {v.version_number !== active_prompt.version_count && (
                    <div className="flex gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={() => set_viewing_version(v)}
                        className="px-2 py-1 text-xs bg-white/5 text-gray-400 hover:text-gray-200 rounded transition-all"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handle_restore(v)}
                        className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded transition-all"
                      >
                        Restore
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review result */}
        {review_result && (
          <div className="mb-6 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-purple-300">Review Results</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  Cost: {cost_display(review_result.usage)} ({review_result.usage.input_tokens.toLocaleString()} in / {review_result.usage.output_tokens.toLocaleString()} out)
                </span>
                <button
                  onClick={() => set_review_result(null)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <div className="prose prose-invert prose-sm max-w-none text-gray-300 mb-4 whitespace-pre-wrap">
              {review_result.suggestions}
            </div>
            {review_result.improved_prompt && (
              <div className="mt-4 pt-4 border-t border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-300">Improved Version</span>
                  <button
                    onClick={() => {
                      set_editor_content(review_result.improved_prompt);
                      set_save_note('Applied Sonnet review suggestions');
                    }}
                    className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded transition-all"
                  >
                    Apply to Editor
                  </button>
                </div>
                <pre className="bg-white/5 border border-white/10 rounded p-3 text-xs text-gray-300 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {review_result.improved_prompt}
                </pre>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // ── Main Render ────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <NavTabs is_localhost={is_localhost} />
        {view === 'list' ? render_list() : render_editor()}
      </div>
    </main>
  );
}
