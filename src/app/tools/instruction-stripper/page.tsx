/**
 * Instruction Stripper Tool
 * Strip AI wrapper text from pasted output, leaving only the clean core content
 */

'use client';

import { useState } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function InstructionStripperPage() {
  const [input, set_input] = useState('');
  const [output, set_output] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [copy_status, set_copy_status] = useState<string | null>(null);
  const [usage, set_usage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);

  const strip = async () => {
    if (!input.trim()) return;

    set_loading(true);
    set_error(null);
    set_output('');
    set_usage(null);

    try {
      const res = await fetch('/api/strip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input }),
      });

      const data = await res.json();

      if (!res.ok) {
        set_error(data.error || 'Something went wrong');
        return;
      }

      set_output(data.stripped);
      set_usage(data.usage);
    } catch {
      set_error('Network error — try again');
    } finally {
      set_loading(false);
    }
  };

  const copy_output = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      set_copy_status('Copied!');
      setTimeout(() => set_copy_status(null), 2000);
    } catch {
      set_copy_status('Copy failed');
      setTimeout(() => set_copy_status(null), 2000);
    }
  };

  const clear_all = () => {
    set_input('');
    set_output('');
    set_error(null);
    set_usage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-4xl mx-auto">
        <NavTabs />

        <h1 className="text-center text-3xl font-light text-cyan-400 mb-2">
          Instruction Stripper
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Paste AI output — get back the clean content, no wrapper
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
              <h3 className="font-medium text-gray-300">Paste AI Output</h3>
              <span className="text-xs text-gray-500">{input.length.toLocaleString()} chars</span>
            </div>
            <textarea
              value={input}
              onChange={e => set_input(e.target.value)}
              placeholder={`Paste the AI response here. For example:\n\nHere's a prompt for VS Code AI chat:\n\n---\n\nAudit: Session Initialization Flow\n\nTrace the exact sequence of operations...\n\n---\n\nPaste that into VS Code AI chat and bring the results back here.`}
              className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200 placeholder-gray-600"
              style={{ minHeight: '220px' }}
            />
          </div>

          {/* Strip button */}
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={strip}
              disabled={loading || !input.trim()}
              className="w-full sm:w-auto px-8 py-[14px] sm:py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-gray-500 text-black font-semibold rounded-lg transition-all text-sm"
            >
              {loading ? 'Stripping...' : 'Strip →'}
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

          {/* Output */}
          {output && (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-medium text-gray-300">Clean Content</h3>
                <div className="flex items-center gap-3">
                  {usage && (
                    <span className="text-xs text-gray-600">
                      {usage.input_tokens + usage.output_tokens} tokens
                    </span>
                  )}
                  <button
                    onClick={copy_output}
                    className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-cyan-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                value={output}
                readOnly
                className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200"
                style={{ minHeight: '180px' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
