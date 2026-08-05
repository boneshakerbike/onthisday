'use client';

import Link from 'next/link';
import { startTransition, useDeferredValue, useRef, useState } from 'react';
import NavTabs from '@/components/nav_tabs';
import MicButton from '@/components/mic_button';
import {
  StoryAudit,
  StoryAuditIssueType,
  STORY_AUDIT_ISSUE_LABELS,
} from '@/lib/story_audit';
import { build_story_body_html, extract_story_title } from '@/lib/story_markup';

interface EditorStory {
  id: string;
  date_display: string;
  content: string;
  blurb: string | null;
  image_url: string | null;
  edited_at: string | null;
}

interface StoryEditorProps {
  story: EditorStory;
  initial_audit: StoryAudit | null;
  initial_audit_updated_at: string | null;
}

function issue_label(type: StoryAuditIssueType): string {
  return STORY_AUDIT_ISSUE_LABELS[type] || type.replace(/_/g, ' ');
}

function count_issue_types(audit: StoryAudit | null): [StoryAuditIssueType, number][] {
  if (!audit) {
    return [];
  }

  const counts = new Map<StoryAuditIssueType, number>();

  for (const source of audit.sources) {
    for (const issue of source.issues) {
      counts.set(issue.type, (counts.get(issue.type) || 0) + 1);
    }
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function source_issue_types(issues: { type: StoryAuditIssueType }[]): StoryAuditIssueType[] {
  return Array.from(new Set(issues.map(issue => issue.type)));
}

export default function StoryEditor({
  story,
  initial_audit,
  initial_audit_updated_at,
}: StoryEditorProps) {
  const [content, set_content] = useState(story.content);
  const [blurb, set_blurb] = useState(story.blurb || '');
  const [image_url, set_image_url] = useState(story.image_url || '');
  const [image_failed, set_image_failed] = useState(false);
  const [audit, set_audit] = useState(initial_audit);
  const [audit_updated_at, set_audit_updated_at] = useState(initial_audit_updated_at);
  const [saving, set_saving] = useState(false);
  const [rerunning_audit, set_rerunning_audit] = useState(false);
  const [status, set_status] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [audit_open, set_audit_open] = useState(true);
  const blurb_ref = useRef<HTMLTextAreaElement>(null);
  const content_ref = useRef<HTMLTextAreaElement>(null);
  const deferred_content = useDeferredValue(content);

  const preview_title = extract_story_title(deferred_content, story.date_display);
  const preview_body = build_story_body_html(deferred_content);

  // Derived here rather than stored, so audits saved before these flags existed
  // still render a breakdown.
  const issue_type_counts = count_issue_types(audit);

  const save_story = async () => {
    set_saving(true);
    set_status(null);

    try {
      const response = await fetch(`/api/story/${story.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          blurb: blurb.trim() || null,
          image_url: image_url.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save story');
      }

      set_status({ type: 'success', message: 'Story saved.' });
    } catch (error) {
      set_status({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save story',
      });
    }

    set_saving(false);
  };

  const rerun_audit = async () => {
    set_rerunning_audit(true);
    set_status(null);

    try {
      const response = await fetch(`/api/story/${story.id}/audit`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to re-run audit');
      }

      startTransition(() => {
        set_audit(data.audit as StoryAudit);
        set_audit_updated_at(new Date().toISOString());
      });
      set_status({ type: 'success', message: 'Audit refreshed.' });
    } catch (error) {
      set_status({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to re-run audit',
      });
    }

    set_rerunning_audit(false);
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
          `,
        }}
      />
      <div className="min-h-screen bg-[#10182b] text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <NavTabs />

          <div className="mb-6 mt-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
                Story Editor
              </p>
              <h1 className="mt-2 text-3xl font-light text-white">
                On This Day - {story.date_display}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Raw HTML on the left, live preview on the right, source audit alongside it.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/story/${story.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15 hover:text-white"
              >
                View Story
              </Link>
              <button
                onClick={save_story}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-300 to-orange-300 px-4 py-2.5 text-sm font-semibold text-[#16213e] transition hover:from-amber-200 hover:to-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {status && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                status.type === 'success'
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  : 'border-red-400/30 bg-red-400/10 text-red-200'
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_320px]">
            <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
                  HTML Source
                </h2>
                <span className="text-xs text-slate-500">Story ID: {story.id}</span>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-sm text-slate-300" htmlFor="story-blurb">
                  Blurb
                </label>
                <MicButton textarea_ref={blurb_ref} value={blurb} on_change={set_blurb} />
              </div>
              <textarea
                id="story-blurb"
                ref={blurb_ref}
                value={blurb}
                onChange={(event) => set_blurb(event.target.value)}
                className="mb-5 min-h-24 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
                spellCheck={false}
              />
              <label className="mb-2 block text-sm text-slate-300" htmlFor="story-image-url">
                Image URL
              </label>
              <div className="mb-5 flex gap-2">
                <input
                  id="story-image-url"
                  type="url"
                  value={image_url}
                  onChange={(event) => {
                    set_image_url(event.target.value);
                    set_image_failed(false);
                  }}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
                  spellCheck={false}
                />
                {image_url && (
                  <button
                    type="button"
                    onClick={() => { set_image_url(''); set_image_failed(false); }}
                    className="shrink-0 rounded-2xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              {image_url && !image_failed && (
                <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external story image URL, next/image needs domain allowlist */}
                  <img
                    src={image_url}
                    alt="Story image preview"
                    referrerPolicy="no-referrer"
                    className="w-full object-cover"
                    onError={() => set_image_failed(true)}
                  />
                </div>
              )}
              {image_url && image_failed && (
                <p className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-300">
                  Image failed to load — the URL may be invalid or hotlink-protected.
                </p>
              )}
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-sm text-slate-300" htmlFor="story-html">
                  Story HTML
                </label>
                <MicButton textarea_ref={content_ref} value={content} on_change={set_content} />
              </div>
              <textarea
                id="story-html"
                ref={content_ref}
                value={content}
                onChange={(event) => set_content(event.target.value)}
                className="min-h-[28rem] w-full rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-cyan-300/50"
                spellCheck={false}
              />
            </section>

            <section className="min-w-0 rounded-3xl border border-white/10 bg-[#f8f3ec] p-5 text-[#37352f]">
              <div className="mb-5 border-b border-[#e5e0d8] pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a56d4f]">
                  Live Preview
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                  {preview_title}
                </h2>
                <p className="mt-2 text-sm italic text-[#7c7c7c]">
                  {story.date_display} story preview
                </p>
              </div>
              <article
                className="prose max-w-none text-[1.04rem] leading-8 prose-p:text-[#37352f] prose-a:text-[#c4704b] prose-a:no-underline hover:prose-a:underline"
                style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
                dangerouslySetInnerHTML={{ __html: preview_body }}
              />
            </section>

            <aside className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
                    Audit Sidebar
                  </h2>
                  <p className="mt-2 text-xs text-slate-400">
                    {audit
                      ? `${audit.summary.issue_count} issue${audit.summary.issue_count === 1 ? '' : 's'} across ${audit.summary.source_count} source post${audit.summary.source_count === 1 ? '' : 's'}`
                      : 'No stored audit yet.'}
                  </p>
                  {audit_updated_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {new Date(audit_updated_at).toLocaleString()}
                    </p>
                  )}
                  {issue_type_counts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {issue_type_counts.map(([type, count]) => (
                        <span
                          key={type}
                          className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[0.7rem] font-medium text-amber-100"
                        >
                          {issue_label(type)} · {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => set_audit_open(!audit_open)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
                >
                  {audit_open ? 'Hide' : 'Show'}
                </button>
              </div>

              <button
                onClick={rerun_audit}
                disabled={rerunning_audit}
                className="mb-4 inline-flex w-full items-center justify-center rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rerunning_audit ? 'Re-running...' : 'Re-run Audit'}
              </button>

              {audit_open && (
                <div className="space-y-3">
                  {!audit && (
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">
                      Run the audit to scan the source posts used for this story.
                    </div>
                  )}

                  {audit?.sources.map((source) => (
                    <details
                      key={source.post_id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-4"
                      open={source.issue_count > 0}
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white break-words">{source.title}</p>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block break-all text-xs text-cyan-300 hover:text-cyan-200"
                            >
                              {source.url}
                            </a>
                            {source.issue_count > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {source_issue_types(source.issues).map((type) => (
                                  <span
                                    key={type}
                                    className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[0.68rem] font-medium text-amber-100"
                                  >
                                    {issue_label(type)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                              source.issue_count > 0
                                ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                                : 'border-white/10 text-slate-300'
                            }`}
                          >
                            {source.issue_count}
                          </span>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        {source.urls_used.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              URLs Used
                            </p>
                            <div className="space-y-1 break-all text-xs text-slate-400">
                              {source.urls_used.map((url) => (
                                <div key={url}>{url}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {source.issue_count === 0 ? (
                          <p className="text-emerald-300">No structural issues detected.</p>
                        ) : (
                          <div className="space-y-2">
                            {source.issues.map((issue, index) => (
                              <div
                                key={`${source.post_id}-${issue.type}-${index}`}
                                className="rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2"
                              >
                                <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-amber-300/80">
                                  {issue_label(issue.type)}
                                </p>
                                <p className="font-medium text-amber-100 break-words">{issue.message}</p>
                                {issue.line !== null && (
                                  <p className="mt-1 text-xs text-amber-200/80">Line {issue.line}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
