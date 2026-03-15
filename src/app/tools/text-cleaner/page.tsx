/**
 * What Am I Trying To Say
 * Paste rough text, get it cleaned up for clarity, edit, then copy
 */

'use client';

import { useState } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function TextCleanerPage() {
  const [input, set_input] = useState('');
  const [cleaned, set_cleaned] = useState('');
  const [story, set_story] = useState('');
  const [loading_action, set_loading_action] = useState<'clean' | 'story' | 'substack' | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [copy_status, set_copy_status] = useState<string | null>(null);
  const [clean_usage, set_clean_usage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);
  const [story_usage, set_story_usage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);
  const [images, set_images] = useState<File[]>([]);
  const [image_previews, set_image_previews] = useState<string[]>([]);
  const [substack, set_substack] = useState('');
  const [substack_usage, set_substack_usage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);

  const clean = async () => {
    if (!input.trim()) return;

    set_loading_action('clean');
    set_error(null);
    set_cleaned('');
    set_story('');
    set_clean_usage(null);
    set_story_usage(null);

    try {
      const res = await fetch('/api/clean-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input }),
      });

      const data = await res.json();

      if (!res.ok) {
        set_error(data.error || 'Something went wrong');
        return;
      }

      set_cleaned(data.cleaned);
      set_clean_usage(data.usage);
    } catch {
      set_error('Network error — try again');
    } finally {
      set_loading_action(null);
    }
  };

  const turn_into_story = async () => {
    if (!cleaned.trim()) return;

    set_loading_action('story');
    set_error(null);
    set_story('');
    set_story_usage(null);

    try {
      const res = await fetch('/api/clean-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cleaned, mode: 'story' }),
      });

      const data = await res.json();

      if (!res.ok) {
        set_error(data.error || 'Something went wrong');
        return;
      }

      set_story(data.story);
      set_story_usage(data.usage);
    } catch {
      set_error('Network error — try again');
    } finally {
      set_loading_action(null);
    }
  };

  const copy_output = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      set_copy_status('Copied!');
      setTimeout(() => set_copy_status(null), 2000);
    } catch {
      set_copy_status('Copy failed');
      setTimeout(() => set_copy_status(null), 2000);
    }
  };

  const clear_all = () => {
    set_input('');
    set_cleaned('');
    set_story('');
    set_error(null);
    set_clean_usage(null);
    set_story_usage(null);
    set_loading_action(null);
    set_images([]);
    set_image_previews([]);
    set_substack('');
    set_substack_usage(null);
  };

  const resize_image = (file: File): Promise<{ data: string; media_type: string }> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max_dim = 1200;
        let { width, height } = img;
        if (width > max_dim || height > max_dim) {
          if (width > height) {
            height = Math.round((height * max_dim) / width);
            width = max_dim;
          } else {
            width = Math.round((width * max_dim) / height);
            height = max_dim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not available')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const data_url = canvas.toDataURL('image/jpeg', 0.7);
        resolve({ data: data_url.split(',')[1], media_type: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handle_image_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    set_images(files);
    const previews = files.map(f => URL.createObjectURL(f));
    set_image_previews(previews);
  };

  const remove_image = (index: number) => {
    set_images(prev => prev.filter((_, i) => i !== index));
    set_image_previews(prev => prev.filter((_, i) => i !== index));
  };

  const generate_substack = async () => {
    if (!story.trim()) return;

    const paragraphs = story.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length !== 3) {
      set_error('Story must contain exactly 3 paragraphs separated by blank lines');
      return;
    }

    set_loading_action('substack');
    set_error(null);
    set_substack('');
    set_substack_usage(null);

    try {
      const resized = await Promise.all(images.map(resize_image));

      const res = await fetch('/api/clean-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'substack',
          opening_scene: paragraphs[0],
          current_situation: paragraphs[1],
          outcome: paragraphs[2],
          images: resized,
        }),
      });

      const data = await res.json();
      if (!res.ok) { set_error(data.error || 'Something went wrong'); return; }
      set_substack(data.substack);
      set_substack_usage(data.usage);
    } catch {
      set_error('Network error — try again');
    } finally {
      set_loading_action(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-4xl mx-auto">
        <NavTabs />

        <h1 className="text-center text-3xl font-light text-cyan-400 mb-2">
          What Am I Trying To Say
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Clean up your ramble, then turn it into a three-paragraph story
        </p>

        {/* Copy toast */}
        {copy_status && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            {copy_status}
          </div>
        )}

        <div className="space-y-4">
          {/* Input */}
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-medium text-gray-300">Your Text</h3>
              <span className="text-xs text-gray-400">{input.length.toLocaleString()} chars</span>
            </div>
            <textarea
              value={input}
              onChange={e => set_input(e.target.value)}
              placeholder="Paste or type what you're trying to say. Don't worry about grammar, spelling, or structure — just get it down."
              className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200 placeholder-gray-600"
              style={{ minHeight: '220px' }}
            />
          </div>

          {/* Clean button */}
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={clean}
              disabled={!!loading_action || !input.trim()}
              className="w-full sm:w-auto px-8 py-[14px] sm:py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-gray-500 text-black font-semibold rounded-lg transition-all text-sm"
            >
              {loading_action === 'clean' ? 'Cleaning...' : 'Clean Up'}
            </button>
            <button
              onClick={clear_all}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-3 bg-[#333] sm:bg-white/10 hover:bg-red-400/20 rounded-lg border border-[#555] sm:border-white/20 text-gray-300 text-sm transition-all"
            >
              Clear
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Output — editable */}
          {cleaned && (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-medium text-gray-300">Cleaned Up</h3>
                <div className="flex items-center gap-3">
                  {clean_usage && (
                    <span className="text-xs text-gray-400">
                      {clean_usage.input_tokens + clean_usage.output_tokens} tokens
                    </span>
                  )}
                  <button
                    onClick={turn_into_story}
                    disabled={!!loading_action}
                    className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-emerald-400/20 disabled:bg-white/10 disabled:text-gray-500 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  >
                    {loading_action === 'story' ? 'Building Story...' : 'Turn Into Story'}
                  </button>
                  <button
                    onClick={() => copy_output(cleaned)}
                    className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-cyan-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                value={cleaned}
                onChange={e => set_cleaned(e.target.value)}
                className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200"
                style={{ minHeight: '180px' }}
              />
            </div>
          )}

          {/* Story output */}
          {story && (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-medium text-gray-300">Story Version</h3>
                <div className="flex items-center gap-3">
                  {story_usage && (
                    <span className="text-xs text-gray-400">
                      {story_usage.input_tokens + story_usage.output_tokens} tokens
                    </span>
                  )}
                  <button
                    onClick={generate_substack}
                    disabled={!!loading_action}
                    className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-violet-400/20 disabled:bg-white/10 disabled:text-gray-500 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  >
                    {loading_action === 'substack' ? 'Generating...' : 'Substack Post'}
                  </button>
                  <button
                    onClick={() => copy_output(story)}
                    className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-emerald-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                value={story}
                onChange={e => set_story(e.target.value)}
                className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200"
                style={{ minHeight: '220px' }}
              />
              <div className="px-4 py-3 border-t border-white/10">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="cursor-pointer px-3 py-1.5 bg-[#333] sm:bg-white/10 hover:bg-white/20 rounded border border-[#555] sm:border-white/20 text-xs text-gray-300 transition-all">
                    Add Photos ({images.length}/5)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={handle_image_change}
                    />
                  </label>
                  {image_previews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob preview URLs can't use next/image */}
                      <img src={src} alt={`Photo ${i + 1}`} className="h-12 w-12 object-cover rounded border border-white/20" />
                      <button
                        onClick={() => remove_image(i)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none"
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {substack && (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-medium text-gray-300">Substack Post</h3>
                <div className="flex items-center gap-3">
                  {substack_usage && (
                    <span className="text-xs text-gray-400">
                      {substack_usage.input_tokens + substack_usage.output_tokens} tokens
                    </span>
                  )}
                  <button
                    onClick={() => copy_output(substack)}
                    className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-violet-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                value={substack}
                onChange={e => set_substack(e.target.value)}
                className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200"
                style={{ minHeight: '300px' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
