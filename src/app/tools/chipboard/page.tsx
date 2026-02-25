/**
 * Chipboard - Bugs, ideas, and everything in between
 * Statuses: Inbox → To Do → In Work → Testing → Done / Rejected
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import NavTabs from '@/components/nav_tabs';

interface TodoItem {
  id: string;
  text: string;
  type: 'bug' | 'feature' | 'task';
  done: boolean;
  added_by: string;
  created_at: string;
}

interface Suggestion {
  id: string;
  slug: string;
  title: string | null;
  content: string;
  status: 'inbox' | 'todo' | 'inwork' | 'testing' | 'done' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  outcome: string | null;
  tags: string | null;
  assigned_to: string | null;
  context: string | null;
  last_context_at: string | null;
  todos: string | null;
  summary: string | null;
  plan: string | null;
}

type GroupKey = 'inbox' | 'todo' | 'inwork' | 'testing' | 'completed';

export default function ChipboardPage() {
  const { data: session } = useSession();
  const is_bill = !!(session?.user && (session.user as {id?: string}).id !== 'guest');

  const [suggestions, set_suggestions] = useState<Suggestion[]>([]);
  const [new_content, set_new_content] = useState('');
  const [loading, set_loading] = useState(true);
  const [submitting, set_submitting] = useState(false);
  const [editing_id, set_editing_id] = useState<string | null>(null);
  const [edit_outcome, set_edit_outcome] = useState('');
  const [editing_content_id, set_editing_content_id] = useState<string | null>(null);
  const [edit_content, set_edit_content] = useState('');
  const [edit_title, set_edit_title] = useState('');
  const [context_open, set_context_open] = useState<string | null>(null);
  const [context_entry, set_context_entry] = useState('');
  const [context_submitting, set_context_submitting] = useState(false);
  const [section_filters, set_section_filters] = useState<Record<GroupKey, string>>({
    inbox: 'all', todo: 'all', inwork: 'all', testing: 'all', completed: 'all',
  });
  const [status_filter, set_status_filter] = useState<string>('all');
  const [keyword_query, set_keyword_query] = useState<string>('');
  const [cleaning_up, set_cleaning_up] = useState<Set<string>>(new Set());
  const [error_msg, set_error_msg] = useState<string | null>(null);
  const [collapsed, set_collapsed] = useState<Record<GroupKey, boolean>>({
    inbox: false,
    todo: false,
    inwork: false,
    testing: false,
    completed: true,
  });

  // Todos state
  const [todo_input, set_todo_input] = useState<Record<string, string>>({});
  const [todo_type, set_todo_type] = useState<Record<string, 'bug' | 'feature' | 'task'>>({});
  const [todo_submitting, set_todo_submitting] = useState(false);

  // Todo inline edit state
  const [editing_todo, set_editing_todo] = useState<{ item_id: string; todo_id: string } | null>(null);
  const [editing_todo_text, set_editing_todo_text] = useState('');

  // Plan state
  const [plan_editing_id, set_plan_editing_id] = useState<string | null>(null);
  const [plan_draft, set_plan_draft] = useState('');

  // Compact state
  const [compact_loading, set_compact_loading] = useState<string | null>(null);
  const [compact_preview, set_compact_preview] = useState<{
    id: string;
    summary: string;
    overflow: boolean;
  } | null>(null);

  // Detail section toggles (per item)
  const [plan_open, set_plan_open] = useState<Set<string>>(new Set());
  const [todos_open, set_todos_open] = useState<Set<string>>(new Set());
  const [summary_open, set_summary_open] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch_suggestions();
  }, []);

  // Auto-expand plan section for items that have plans
  useEffect(() => {
    const with_plan = suggestions.filter(s => s.plan).map(s => s.id);
    if (with_plan.length > 0) {
      set_plan_open(prev => {
        const next = new Set(prev);
        with_plan.forEach(id => next.add(id));
        return next;
      });
    }
  }, [suggestions]);

  // Auto-expand the relevant section when a status filter is selected
  useEffect(() => {
    if (status_filter === 'done') {
      set_collapsed(prev => ({ ...prev, completed: false }));
    } else if (status_filter === 'inbox') {
      set_collapsed(prev => ({ ...prev, inbox: false }));
    } else if (status_filter === 'todo') {
      set_collapsed(prev => ({ ...prev, todo: false }));
    } else if (status_filter === 'inwork') {
      set_collapsed(prev => ({ ...prev, inwork: false }));
    } else if (status_filter === 'testing') {
      set_collapsed(prev => ({ ...prev, testing: false }));
    }
  }, [status_filter]);

  // Auto-expand all sections when a keyword search is active
  useEffect(() => {
    if (keyword_query.trim()) {
      set_collapsed({ inbox: false, todo: false, inwork: false, testing: false, completed: false });
    }
  }, [keyword_query]);

  function api_base() {
    return window.location.hostname === 'localhost' ? 'https://8i11.vercel.app' : '';
  }

  async function fetch_suggestions() {
    try {
      const res = await fetch('/api/suggestions');
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

  async function handle_submit(e: React.FormEvent) {
    e.preventDefault();
    if (!new_content.trim() || submitting) return;

    set_submitting(true);
    set_error_msg(null);
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
      } else {
        set_error_msg(`Add failed (${res.status}): ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      set_error_msg(`Add failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      set_submitting(false);
    }
  }

  async function update_status(id: string, status: Suggestion['status'], outcome?: string) {
    set_error_msg(null);
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
      } else {
        set_error_msg(`Status update failed (${res.status}): ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      set_error_msg(`Status update failed: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  async function save_content(id: string) {
    if (!edit_content.trim()) return;
    set_error_msg(null);
    try {
      const body: Record<string, string> = { id, content: edit_content.trim() };
      if (edit_title.trim()) body.title = edit_title.trim();
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        set_editing_content_id(null);
        set_edit_content('');
        set_edit_title('');
        fetch_suggestions();
      } else {
        set_error_msg(`Edit failed (${res.status}): ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      set_error_msg(`Edit failed: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  async function run_cleanup(id: string) {
    set_cleaning_up(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cleanup: true })
      });
      const data = await res.json();
      if (data.success) fetch_suggestions();
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      set_cleaning_up(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function save_assignee(id: string, value: string) {
    try {
      await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, assigned_to: value || null })
      });
      fetch_suggestions();
    } catch (error) {
      console.error('Failed to update assignee:', error);
    }
  }

  async function delete_suggestion(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/suggestions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetch_suggestions();
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
    }
  }

  async function append_context(id: string) {
    if (!context_entry.trim() || context_submitting) return;
    set_context_submitting(true);
    set_error_msg(null);
    try {
      const res = await fetch('/api/suggestions/context_append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, agent: 'bill', entry: context_entry.trim() })
      });
      const data = await res.json();
      if (data.success) {
        set_context_entry('');
        fetch_suggestions();
      } else {
        set_error_msg(`Context append failed (${res.status}): ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      set_error_msg(`Context append failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      set_context_submitting(false);
    }
  }

  function parse_todos(json: string | null): TodoItem[] {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  }

  async function add_todo(item_id: string) {
    const text = (todo_input[item_id] || '').trim();
    if (!text || todo_submitting) return;
    set_todo_submitting(true);
    set_error_msg(null);
    try {
      const res = await fetch('/api/suggestions/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item_id,
          text,
          type: todo_type[item_id] || 'task',
          added_by: 'bill',
        }),
      });
      const data = await res.json();
      if (data.success) {
        set_todo_input(prev => ({ ...prev, [item_id]: '' }));
        fetch_suggestions();
      } else {
        set_error_msg(`Add todo failed: ${data.error}`);
      }
    } catch (error) {
      set_error_msg(`Add todo failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      set_todo_submitting(false);
    }
  }

  async function toggle_todo(item_id: string, todo_id: string, done: boolean) {
    try {
      const res = await fetch('/api/suggestions/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item_id, todo_id, done }),
      });
      const data = await res.json();
      if (data.success) fetch_suggestions();
    } catch (error) {
      console.error('Toggle todo failed:', error);
    }
  }

  async function remove_todo(item_id: string, todo_id: string) {
    try {
      const res = await fetch('/api/suggestions/todos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item_id, todo_id }),
      });
      const data = await res.json();
      if (data.success) fetch_suggestions();
    } catch (error) {
      console.error('Delete todo failed:', error);
    }
  }

  async function save_todo_text(item_id: string, todo_id: string, new_text: string) {
    const trimmed = new_text.trim();
    if (!trimmed) { set_editing_todo(null); return; }
    try {
      const res = await fetch('/api/suggestions/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item_id, todo_id, text: trimmed }),
      });
      const data = await res.json();
      if (data.success) fetch_suggestions();
    } catch (error) {
      console.error('Edit todo failed:', error);
    } finally {
      set_editing_todo(null);
    }
  }

  async function save_plan(item_id: string) {
    set_error_msg(null);
    try {
      const res = await fetch('/api/suggestions/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item_id, plan: plan_draft.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        set_plan_editing_id(null);
        set_plan_draft('');
        fetch_suggestions();
      } else {
        set_error_msg(`Save plan failed: ${data.error}`);
      }
    } catch (error) {
      set_error_msg(`Save plan failed: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  async function run_compact(item_id: string) {
    set_compact_loading(item_id);
    set_error_msg(null);
    try {
      const res = await fetch('/api/suggestions/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item_id, confirm: false }),
      });
      const data = await res.json();
      if (data.success && data.preview) {
        set_compact_preview({
          id: item_id,
          summary: data.summary,
          overflow: data.overflow,
        });
      } else {
        set_error_msg(`Compact failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      set_error_msg(`Compact failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      set_compact_loading(null);
    }
  }

  async function save_compact() {
    if (!compact_preview) return;
    set_error_msg(null);
    try {
      const res = await fetch('/api/suggestions/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: compact_preview.id, confirm: true }),
      });
      const data = await res.json();
      if (data.success) {
        set_compact_preview(null);
        fetch_suggestions();
      } else {
        set_error_msg(`Save compact failed: ${data.error}`);
      }
    } catch (error) {
      set_error_msg(`Save compact failed: ${error instanceof Error ? error.message : 'Network error'}`);
    }
  }

  function toggle_set(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function format_date(date_str: string): string {
    // SQLite CURRENT_TIMESTAMP has no timezone suffix — normalize to UTC before parsing
    const normalized = date_str.includes('T') || date_str.endsWith('Z')
      ? date_str
      : date_str.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toggle_group(group: GroupKey) {
    set_collapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }

  const status_filtered = status_filter === 'all' ? suggestions
    : status_filter === 'done' ? suggestions.filter(s => s.status === 'done' || s.status === 'rejected')
    : suggestions.filter(s => s.status === status_filter);

  const keyword_filtered = keyword_query.trim()
    ? status_filtered.filter(s => {
        const q = keyword_query.toLowerCase();
        return (
          s.title?.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q) ||
          s.tags?.toLowerCase().includes(q) ||
          s.assigned_to?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.plan?.toLowerCase().includes(q) ||
          s.summary?.toLowerCase().includes(q) ||
          s.todos?.toLowerCase().includes(q)
        );
      })
    : status_filtered;

  const grouped_raw = {
    inbox:     keyword_filtered.filter(s => s.status === 'inbox'),
    todo:      keyword_filtered.filter(s => s.status === 'todo'),
    inwork:    keyword_filtered.filter(s => s.status === 'inwork'),
    testing:   keyword_filtered.filter(s => s.status === 'testing'),
    completed: keyword_filtered.filter(s => s.status === 'done' || s.status === 'rejected'),
  };

  function apply_section_filter(items: Suggestion[], key: GroupKey): Suggestion[] {
    const f = section_filters[key];
    if (f === 'all') return items;
    if (f === 'unassigned') return items.filter(s => !s.assigned_to);
    return items.filter(s => s.assigned_to === f);
  }

  const grouped = {
    inbox:     apply_section_filter(grouped_raw.inbox,     'inbox'),
    todo:      apply_section_filter(grouped_raw.todo,      'todo'),
    inwork:    apply_section_filter(grouped_raw.inwork,    'inwork'),
    testing:   apply_section_filter(grouped_raw.testing,   'testing'),
    completed: apply_section_filter(grouped_raw.completed, 'completed'),
  };

  type ColorKey = 'orange' | 'yellow' | 'cyan' | 'amber' | 'gray';

  const group_config: { key: GroupKey; title: string; color: ColorKey; emptyText: string }[] = [
    { key: 'inbox',     title: 'Inbox',           color: 'orange', emptyText: 'Inbox is empty' },
    { key: 'todo',      title: 'To Do',           color: 'yellow', emptyText: 'Nothing queued up' },
    { key: 'inwork',    title: 'In Work',         color: 'cyan',   emptyText: 'Nothing in progress' },
    { key: 'testing',   title: 'Testing',         color: 'amber',  emptyText: 'Nothing in testing' },
    { key: 'completed', title: 'Done / Rejected', color: 'gray',   emptyText: 'No completed items' },
  ];

  function render_suggestion(s: Suggestion) {
    const status_colors = {
      inbox:    'bg-orange-500/20 text-orange-400 border-orange-500/30',
      todo:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      inwork:   'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      testing:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
      done:     'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const status_labels = {
      inbox: 'Inbox', todo: 'To Do', inwork: 'In Work', testing: 'Testing', done: 'Done', rejected: 'Rejected'
    };

    return (
      <div key={s.id} className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all">
        <div className="flex flex-col gap-3">

          {/* Header row: status badge + date + id + assignee */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs rounded border ${status_colors[s.status]}`}>
              {status_labels[s.status]}
            </span>
            <span className="text-xs text-gray-500">{format_date(s.created_at)}</span>
            <span className="text-xs text-gray-600 font-mono">{s.id}</span>
            {s.assigned_to && (
              <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                {s.assigned_to}
              </span>
            )}
            {s.plan && (
              <span className="px-1.5 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded">Plan</span>
            )}
            {(() => {
              const todos = parse_todos(s.todos);
              if (todos.length === 0) return null;
              const done_count = todos.filter(t => t.done).length;
              const all_done = done_count === todos.length;
              return (
                <span className={`px-1.5 py-0.5 text-xs rounded border ${all_done ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/10 text-gray-400 border-white/10'}`}>
                  {done_count}/{todos.length}
                </span>
              );
            })()}
          </div>

          {/* Title + Content */}
          {editing_content_id === s.id ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={edit_title}
                onChange={(e) => set_edit_title(e.target.value)}
                placeholder="Title (optional)"
                className="w-full bg-white/5 border border-cyan-400/30 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <textarea
                value={edit_content}
                onChange={(e) => set_edit_content(e.target.value)}
                rows={4}
                className="w-full bg-white/5 border border-cyan-400/50 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-y min-h-[80px]"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => save_content(s.id)} disabled={!edit_content.trim()}
                  className="px-3 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 rounded transition-all">
                  Save
                </button>
                <button onClick={() => { set_editing_content_id(null); set_edit_content(''); set_edit_title(''); }}
                  className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-all">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {s.title && (
                <p className="text-white font-semibold break-words">{s.title}</p>
              )}
              <p className={`break-words ${s.title ? 'text-sm text-gray-400' : 'text-gray-200'}`}>{s.content}</p>
            </>
          )}

          {s.outcome && (
            <p className="text-sm text-gray-400 italic break-words">Outcome: {s.outcome}</p>
          )}

          {/* Tags */}
          {s.tags && (
            <div className="flex flex-wrap gap-1">
              {s.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 text-xs bg-white/10 text-gray-400 rounded">{tag}</span>
              ))}
            </div>
          )}

          {/* Plan section */}
          {(s.plan || plan_editing_id === s.id) && (
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle_set(set_plan_open, s.id)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-cyan-400 hover:bg-white/5 transition-all"
              >
                <svg className={`w-3 h-3 transition-transform ${plan_open.has(s.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Plan
              </button>
              {plan_open.has(s.id) && (
                <div className="px-3 pb-3">
                  {plan_editing_id === s.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={plan_draft}
                        onChange={(e) => set_plan_draft(e.target.value)}
                        rows={12}
                        className="w-full bg-white/5 border border-cyan-400/30 rounded px-3 py-2 text-xs text-white font-mono placeholder-gray-500 focus:outline-none resize-y"
                        placeholder="Implementation plan, reference doc..."
                      />
                      <div className="flex gap-2">
                        <button onClick={() => save_plan(s.id)}
                          className="px-3 py-1 text-xs bg-cyan-500 hover:bg-cyan-600 rounded transition-all">Save</button>
                        <button onClick={() => { set_plan_editing_id(null); set_plan_draft(''); }}
                          className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-all">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono bg-white/5 rounded p-3 max-h-64 overflow-y-auto">
                        {s.plan}
                      </pre>
                      {is_bill && (
                        <button onClick={() => { set_plan_editing_id(s.id); set_plan_draft(s.plan || ''); set_plan_open(prev => new Set(prev).add(s.id)); }}
                          className="mt-2 px-2 py-1 text-xs bg-white/10 text-gray-300 rounded hover:bg-white/20 transition-all">
                          Edit Plan
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Todos section */}
          {(() => {
            const todos = parse_todos(s.todos);
            const done_count = todos.filter(t => t.done).length;
            const has_todos = todos.length > 0;

            return (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle_set(set_todos_open, s.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-1.5">
                    <svg className={`w-3 h-3 transition-transform ${todos_open.has(s.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Todos
                  </div>
                  {has_todos && (
                    <span className={`px-1.5 py-0.5 text-xs rounded ${done_count === todos.length ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}>
                      {done_count}/{todos.length}
                    </span>
                  )}
                </button>
                {todos_open.has(s.id) && (
                  <div className="px-3 pb-3">
                    {has_todos && (
                      <div className="space-y-1 mb-3">
                        {todos.map(t => {
                          const type_colors = {
                            bug: 'bg-red-500/20 text-red-400',
                            feature: 'bg-cyan-500/20 text-cyan-400',
                            task: 'bg-gray-500/20 text-gray-400',
                          };
                          return (
                            <div key={t.id} className="flex items-center gap-2 group">
                              {is_bill ? (
                                <button
                                  onClick={() => toggle_todo(s.id, t.id, !t.done)}
                                  className={`w-4 h-4 flex-shrink-0 rounded border transition-all ${t.done ? 'bg-green-500/30 border-green-500/50' : 'border-white/20 hover:border-white/40'}`}
                                >
                                  {t.done && <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                </button>
                              ) : (
                                <span className={`w-4 h-4 flex-shrink-0 rounded border ${t.done ? 'bg-green-500/30 border-green-500/50' : 'border-white/20'} flex items-center justify-center`}>
                                  {t.done && <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                </span>
                              )}
                              {is_bill && editing_todo?.item_id === s.id && editing_todo?.todo_id === t.id ? (
                                <input
                                  type="text"
                                  value={editing_todo_text}
                                  onChange={(e) => set_editing_todo_text(e.target.value)}
                                  onBlur={() => save_todo_text(s.id, t.id, editing_todo_text)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') save_todo_text(s.id, t.id, editing_todo_text); if (e.key === 'Escape') set_editing_todo(null); }}
                                  maxLength={100}
                                  autoFocus
                                  className="flex-1 bg-white/5 border border-cyan-400/30 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                                />
                              ) : (
                                <span
                                  className={`text-xs flex-1 ${t.done ? 'line-through text-gray-600' : 'text-gray-300'} ${is_bill ? 'cursor-pointer hover:text-white' : ''}`}
                                  onClick={() => { if (is_bill) { set_editing_todo({ item_id: s.id, todo_id: t.id }); set_editing_todo_text(t.text); } }}
                                >
                                  {t.text}
                                </span>
                              )}
                              <span className={`px-1 py-0.5 text-[10px] rounded ${type_colors[t.type]}`}>{t.type}</span>
                              {is_bill && (
                                <button
                                  onClick={() => remove_todo(s.id, t.id)}
                                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Add todo input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={todo_input[s.id] || ''}
                        onChange={(e) => set_todo_input(prev => ({ ...prev, [s.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') add_todo(s.id); }}
                        placeholder="Add a todo..."
                        maxLength={100}
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/30"
                      />
                      <select
                        value={todo_type[s.id] || 'task'}
                        onChange={(e) => set_todo_type(prev => ({ ...prev, [s.id]: e.target.value as 'bug' | 'feature' | 'task' }))}
                        className="bg-white/5 border border-white/10 rounded px-1 py-1 text-xs text-gray-400 focus:outline-none cursor-pointer"
                      >
                        <option value="task">task</option>
                        <option value="bug">bug</option>
                        <option value="feature">feature</option>
                      </select>
                      <button
                        onClick={() => add_todo(s.id)}
                        disabled={!(todo_input[s.id] || '').trim() || todo_submitting}
                        className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40 rounded transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Summary / Compact section */}
          {(s.summary || s.context) && (
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle_set(set_summary_open, s.id)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:bg-white/5 transition-all"
              >
                <svg className={`w-3 h-3 transition-transform ${summary_open.has(s.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Summary
                {s.summary && <span className="text-green-500/60 text-[10px]">compacted</span>}
              </button>
              {summary_open.has(s.id) && (
                <div className="px-3 pb-3">
                  {s.summary ? (
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap break-words font-mono bg-white/5 rounded p-3 max-h-48 overflow-y-auto mb-2">
                      {s.summary}
                    </pre>
                  ) : (
                    <p className="text-xs text-gray-600 mb-2">No summary yet.</p>
                  )}

                  {/* Compact preview */}
                  {compact_preview && compact_preview.id === s.id && (
                    <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3 mb-2">
                      <p className="text-xs text-yellow-400 font-medium mb-2">Compaction Preview</p>
                      {compact_preview.overflow && (
                        <p className="text-xs text-amber-400 mb-2">Context exceeds 30KB. Consider archiving historical entries.</p>
                      )}
                      <p className="text-xs text-gray-400 mb-1 font-medium">Summary:</p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono bg-black/20 rounded p-2 mb-2 max-h-32 overflow-y-auto">
                        {compact_preview.summary}
                      </pre>
                      <div className="flex gap-2">
                        <button onClick={save_compact}
                          className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 rounded transition-all">Save Compaction</button>
                        <button onClick={() => set_compact_preview(null)}
                          className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-all">Discard</button>
                      </div>
                    </div>
                  )}

                  {is_bill && !compact_preview && s.context && (
                    <button
                      onClick={() => run_compact(s.id)}
                      disabled={compact_loading === s.id}
                      className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 rounded transition-all"
                    >
                      {compact_loading === s.id ? 'Compacting...' : 'Compact Context'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Edit content */}
            <button onClick={() => { set_editing_content_id(s.id); set_edit_content(s.content); set_edit_title(s.title || ''); }}
              className="px-2 py-1 text-xs bg-white/10 text-gray-300 rounded hover:bg-white/20 transition-all">
              Edit
            </button>

            {/* AI cleanup */}
            <button
              onClick={() => run_cleanup(s.id)}
              disabled={cleaning_up.has(s.id)}
              className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 disabled:opacity-40 transition-all"
            >
              {cleaning_up.has(s.id) ? 'Cleaning…' : 'Clean up'}
            </button>

            {/* Status progression */}
            {s.status === 'inbox' && (
              <>
                <button onClick={() => update_status(s.id, 'todo')}
                  className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-all">
                  → To Do
                </button>
                <button onClick={() => update_status(s.id, 'rejected')}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all">
                  Reject
                </button>
              </>
            )}
            {s.status === 'todo' && (
              <>
                <button onClick={() => update_status(s.id, 'inwork')}
                  className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-all">
                  → In Work
                </button>
                <button onClick={() => update_status(s.id, 'testing')}
                  className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-all">
                  → Testing
                </button>
                <button onClick={() => update_status(s.id, 'inbox')}
                  className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-all">
                  ← Inbox
                </button>
                <button onClick={() => update_status(s.id, 'rejected')}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all">
                  Reject
                </button>
              </>
            )}
            {s.status === 'inwork' && (
              <>
                <button onClick={() => { set_editing_id(s.id); set_edit_outcome(''); }}
                  className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all">
                  ✓ Done
                </button>
                <button onClick={() => update_status(s.id, 'testing')}
                  className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-all">
                  → Testing
                </button>
                <button onClick={() => update_status(s.id, 'todo')}
                  className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-all">
                  ← To Do
                </button>
              </>
            )}
            {s.status === 'testing' && (
              <>
                <button onClick={() => { set_editing_id(s.id); set_edit_outcome(''); }}
                  className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all">
                  ✓ Done
                </button>
                <button onClick={() => update_status(s.id, 'inwork')}
                  className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-all">
                  ← In Work
                </button>
              </>
            )}
            {(s.status === 'done' || s.status === 'rejected') && (
              <button onClick={() => update_status(s.id, 'inbox')}
                className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-all">
                ← Inbox
              </button>
            )}

            {/* Assign to */}
            <select
              value={s.assigned_to || ''}
              onChange={(e) => save_assignee(s.id, e.target.value)}
              className="px-2 py-1 text-xs bg-white/5 border border-white/10 text-gray-400 rounded focus:outline-none focus:border-purple-400/50 cursor-pointer"
            >
              <option value="">Unassigned</option>
              <option value="Chip">Chip</option>
              <option value="Hex">Hex</option>
              <option value="Bill">Bill</option>
            </select>

            {is_bill && !s.plan && plan_editing_id !== s.id && (
              <button onClick={() => { set_plan_editing_id(s.id); set_plan_draft(''); set_plan_open(prev => new Set(prev).add(s.id)); }}
                className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-all">
                + Plan
              </button>
            )}

            {is_bill && (
              <button onClick={() => delete_suggestion(s.id)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-red-400 transition-all ml-auto">
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Context section */}
        <div className="mt-3">
          <button
            onClick={() => { set_context_open(context_open === s.id ? null : s.id); set_context_entry(''); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-all"
          >
            <svg className={`w-3 h-3 transition-transform ${context_open === s.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Context
            {s.last_context_at && <span className="text-gray-600">· {format_date(s.last_context_at)}</span>}
          </button>

          {context_open === s.id && (
            <div className="mt-2 p-3 bg-black/20 border border-white/10 rounded-lg">
              {s.context ? (
                <pre className="text-xs text-gray-400 whitespace-pre-wrap break-words font-mono mb-3 max-h-48 overflow-y-auto">
                  {s.context}
                </pre>
              ) : (
                <p className="text-xs text-gray-600 mb-3">No context yet.</p>
              )}
              <textarea
                value={context_entry}
                onChange={(e) => set_context_entry(e.target.value)}
                placeholder="Append a context note…"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/30 resize-y"
              />
              <button
                onClick={() => append_context(s.id)}
                disabled={!context_entry.trim() || context_submitting}
                className="mt-2 px-3 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40 rounded transition-all"
              >
                {context_submitting ? 'Appending…' : 'Append'}
              </button>
            </div>
          )}
        </div>

        {/* Done outcome modal */}
        {editing_id === s.id && (
          <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
            <label className="block text-sm text-gray-400 mb-2">What was the outcome? (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={edit_outcome}
                onChange={(e) => set_edit_outcome(e.target.value)}
                placeholder="e.g., Shipped in session 40"
                className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
              />
              <button onClick={() => update_status(s.id, 'done', edit_outcome)}
                className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 rounded transition-all">
                Save
              </button>
              <button onClick={() => { set_editing_id(null); set_edit_outcome(''); }}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <NavTabs />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-cyan-400 mb-1">Chipboard</h1>
          <p className="text-gray-400 text-sm">Bugs, ideas, and everything in between.</p>
        </div>

        {/* Error banner */}
        {error_msg && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center justify-between">
            <span className="text-sm text-red-400">{error_msg}</span>
            <button onClick={() => set_error_msg(null)} className="text-red-400 hover:text-red-300 ml-3">×</button>
          </div>
        )}

        {/* New item form */}
        <form onSubmit={handle_submit} className="mb-6">
          <div className="flex flex-col gap-3">
            <textarea
              value={new_content}
              onChange={(e) => set_new_content(e.target.value)}
              placeholder="What's on your mind? AI will clean it up before saving."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 resize-y min-h-[80px]"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!new_content.trim() || submitting}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
              >
                {submitting ? 'Cleaning up & saving…' : 'Add to Inbox'}
              </button>
              {submitting && (
                <span className="text-xs text-gray-500">AI is cleaning up your entry…</span>
              )}
            </div>
          </div>
        </form>


        {/* Keyword search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={keyword_query}
            onChange={(e) => set_keyword_query(e.target.value)}
            placeholder="Filter by keyword…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
          />
          {keyword_query && (
            <button
              onClick={() => set_keyword_query('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-all"
            >
              ×
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {[
            { value: 'all',     label: 'All' },
            { value: 'inbox',   label: 'Inbox' },
            { value: 'todo',    label: 'To Do' },
            { value: 'inwork',  label: 'In Work' },
            { value: 'testing', label: 'Testing' },
            { value: 'done',    label: 'Done' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set_status_filter(value)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                status_filter === value
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading…</div>
        ) : (
          <div className="space-y-6">
            {group_config.map(({ key, title, color, emptyText }) => {
              const items = grouped[key];
              const count = items.length;
              const is_collapsed = collapsed[key];

              const header_colors = {
                orange: 'border-orange-500/30 text-orange-400',
                yellow: 'border-yellow-500/30 text-yellow-400',
                cyan:   'border-cyan-500/30 text-cyan-400',
                amber:  'border-amber-500/30 text-amber-400',
                gray:   'border-gray-500/30 text-gray-400',
              };
              const count_colors = {
                orange: 'bg-orange-500/20 text-orange-400',
                yellow: 'bg-yellow-500/20 text-yellow-400',
                cyan:   'bg-cyan-500/20 text-cyan-400',
                amber:  'bg-amber-500/20 text-amber-400',
                gray:   'bg-gray-500/20 text-gray-400',
              };

              // Hide empty sections when a status filter is active
              if (status_filter !== 'all' && count === 0) return null;

              return (
                <section key={key}>
                  <button
                    onClick={() => toggle_group(key)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border bg-white/5 hover:bg-white/10 transition-all ${header_colors[color]}`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-4 h-4 transition-transform ${is_collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium">{title}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded ${count_colors[color]}`}>{count}</span>
                  </button>

                  {!is_collapsed && (
                    <div className="mt-3 pl-2 border-l-2 border-white/10 ml-2">
                      {/* Per-section assignee filter */}
                      {(() => {
                        const section_assignees = Array.from(new Set(
                          grouped_raw[key].map(s => s.assigned_to).filter(Boolean) as string[]
                        )).sort();
                        return section_assignees.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap px-1 pb-3">
                            {['all', 'unassigned', ...section_assignees].map(a => (
                              <button
                                key={a}
                                onClick={() => set_section_filters(prev => ({ ...prev, [key]: a }))}
                                className={`px-2 py-0.5 text-xs rounded transition-all ${
                                  section_filters[key] === a
                                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                                    : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                                }`}
                              >
                                {a === 'all' ? 'All' : a === 'unassigned' ? 'Unassigned' : a}
                              </button>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      <div className="space-y-3">
                        {count === 0 ? (
                          <p className="text-gray-500 text-sm py-3 pl-4">{emptyText}</p>
                        ) : (
                          items.map(render_suggestion)
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* API info for agents */}
        <div className="mt-12 p-4 bg-white/5 border border-white/10 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 mb-2">API</h3>
          <code className="text-xs text-cyan-400">GET /api/suggestions?status=inbox</code>
          <p className="text-xs text-gray-500 mt-1">Statuses: inbox → todo → inwork → testing → done / rejected</p>
        </div>
      </div>
    </main>
  );
}
