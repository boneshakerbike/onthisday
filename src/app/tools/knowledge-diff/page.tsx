'use client';

/**
 * Knowledge Diff Tool
 * Compares two knowledge documents for potential information loss
 * Two-step flow: analyze for losses, then generate appendix if needed
 */

import { useState } from 'react';
import NavTabs from '@/components/nav_tabs';

interface UsageInfo {
  analysis_input: number;
  analysis_output: number;
  appendix_input: number;
  appendix_output: number;
}

interface DiffResult {
  has_losses: boolean;
  truncation_detected?: boolean;
  analysis: string;
  appendix?: string;
  usage: UsageInfo;
}

export default function KnowledgeDiffPage() {
  const [old_doc, set_old_doc] = useState('');
  const [new_doc, set_new_doc] = useState('');
  const [use_opus, set_use_opus] = useState(false);
  const [status, set_status] = useState('');  // '' | 'Analyzing...' | 'Generating appendix...'
  const [result, set_result] = useState<DiffResult | null>(null);
  const [error, set_error] = useState('');
  const [copied, set_copied] = useState(false);

  async function api_call(body: Record<string, unknown>) {
    const response = await fetch('/api/knowledge-diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        response.status === 504
          ? 'Request timed out. The documents may be too large to process together.'
          : `Server error (${response.status}). Try with smaller documents.`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  async function handle_compare() {
    if (!old_doc.trim() || !new_doc.trim()) {
      set_error('Please paste both documents');
      return;
    }

    set_status('Analyzing...');
    set_error('');
    set_result(null);

    try {
      // Step 1: Analyze
      const analysis_result = await api_call({
        step: 'analyze',
        old_doc,
        new_doc
      });

      const combined_usage: UsageInfo = {
        analysis_input: analysis_result.usage.input,
        analysis_output: analysis_result.usage.output,
        appendix_input: 0,
        appendix_output: 0
      };

      if (analysis_result.truncation_detected) {
        set_result({
          has_losses: false,
          truncation_detected: true,
          analysis: analysis_result.analysis,
          usage: combined_usage
        });
        set_status('');
        return;
      }

      if (!analysis_result.has_losses) {
        set_result({
          has_losses: false,
          analysis: analysis_result.analysis,
          usage: combined_usage
        });
        set_status('');
        return;
      }

      // Step 2: Generate appendix
      set_status('Generating appendix...');

      const appendix_result = await api_call({
        step: 'appendix',
        old_doc,
        analysis: analysis_result.analysis,
        use_opus
      });

      combined_usage.appendix_input = appendix_result.usage.input;
      combined_usage.appendix_output = appendix_result.usage.output;

      set_result({
        has_losses: true,
        analysis: analysis_result.analysis,
        appendix: appendix_result.appendix,
        usage: combined_usage
      });
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      set_status('');
    }
  }

  async function handle_copy() {
    if (result?.appendix) {
      await navigator.clipboard.writeText(result.appendix);
      set_copied(true);
      setTimeout(() => set_copied(false), 2000);
    }
  }

  function calculate_cost(usage: UsageInfo): string {
    // Sonnet: $3/M in, $15/M out; Opus: $15/M in, $75/M out
    const analysis_cost = (usage.analysis_input * 3 + usage.analysis_output * 15) / 1_000_000;
    let appendix_cost = 0;
    if (usage.appendix_input > 0) {
      if (use_opus) {
        appendix_cost = (usage.appendix_input * 15 + usage.appendix_output * 75) / 1_000_000;
      } else {
        appendix_cost = (usage.appendix_input * 3 + usage.appendix_output * 15) / 1_000_000;
      }
    }
    return (analysis_cost + appendix_cost).toFixed(4);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
        <NavTabs />

        <h1 style={{ fontSize: '1.5em', marginBottom: '8px' }}>Knowledge Diff</h1>
        <p style={{ color: '#bbb', marginBottom: '24px' }}>
          Compare two knowledge documents to detect potential information loss
        </p>

        <div className="knowledge-diff-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Old Document */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 500,
              color: '#ccc'
            }}>
              OLD Document
            </label>
            <textarea
              value={old_doc}
              onChange={(e) => set_old_doc(e.target.value)}
              placeholder="Paste your original/old knowledge document here..."
              style={{
                width: '100%',
                height: '300px',
                padding: '12px',
                background: '#252525',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#e0e0e0',
                fontSize: '13px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
              {old_doc.length.toLocaleString()} characters
            </div>
          </div>

          {/* New Document */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 500,
              color: '#ccc'
            }}>
              NEW Document
            </label>
            <textarea
              value={new_doc}
              onChange={(e) => set_new_doc(e.target.value)}
              placeholder="Paste your updated/new knowledge document here..."
              style={{
                width: '100%',
                height: '300px',
                padding: '12px',
                background: '#252525',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#e0e0e0',
                fontSize: '13px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
              {new_doc.length.toLocaleString()} characters
            </div>
          </div>
        </div>

        {/* Controls */}
        <div
          className="knowledge-diff-actions"
          style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          <button
            onClick={handle_compare}
            disabled={!!status || !old_doc.trim() || !new_doc.trim()}
            className="knowledge-diff-primary"
            style={{
              padding: '12px 32px',
              background: status ? '#333' : '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: status ? 'wait' : 'pointer',
              opacity: (!old_doc.trim() || !new_doc.trim()) ? 0.5 : 1
            }}
          >
            {status || 'Compare'}
          </button>

          <button
            onClick={() => { set_old_doc(''); set_new_doc(''); set_result(null); set_error(''); }}
            disabled={!!status || (!old_doc && !new_doc && !result)}
            className="knowledge-diff-secondary"
            style={{
              padding: '12px 24px',
              background: '#333',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              opacity: (!old_doc && !new_doc && !result) ? 0.3 : 1
            }}
          >
            Clear
          </button>

          <label
            className="knowledge-diff-option"
            style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#bbb',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={use_opus}
              onChange={(e) => set_use_opus(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Use Opus 4.5 for appendix (highest quality, ~5x cost)
          </label>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#3f1d1d',
            border: '1px solid #7f2d2d',
            borderRadius: '8px',
            color: '#fca5a5',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            background: '#252525',
            border: `1px solid ${result.truncation_detected ? '#b45309' : result.has_losses ? '#854d0e' : '#166534'}`,
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              background: result.truncation_detected ? '#78350f' : result.has_losses ? '#422006' : '#14532d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>
                  {result.truncation_detected ? '\u26A0' : result.has_losses ? '\u26A0' : '\u2713'}
                </span>
                <div>
                  <div style={{
                    fontWeight: 600,
                    color: result.truncation_detected ? '#fb923c' : result.has_losses ? '#fde047' : '#86efac'
                  }}>
                    {result.truncation_detected
                      ? 'Input may be truncated or wrong document'
                      : result.has_losses ? 'Knowledge would be lost' : 'No knowledge loss detected'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#bbb' }}>
                    {result.truncation_detected
                      ? 'The NEW document looks significantly shorter or cut off — check your inputs before trusting results'
                      : result.has_losses
                        ? 'Appendix generated — copy and paste at the end of your new document'
                        : 'Safe to replace the old document with the new one'}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                color: '#aaa',
                textAlign: 'right'
              }}>
                <div>Cost: ${calculate_cost(result.usage)}</div>
                <div>
                  {(result.usage.analysis_input + result.usage.appendix_input).toLocaleString()} in / {' '}
                  {(result.usage.analysis_output + result.usage.appendix_output).toLocaleString()} out
                </div>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Appendix (when losses found) */}
              {result.appendix && (
                <div style={{ marginBottom: '16px' }}>
                  <div
                    className="knowledge-diff-appendix-header"
                    style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <label style={{ fontWeight: 500, color: '#ccc' }}>
                      Appendix (paste at end of new document)
                    </label>
                    <button
                      onClick={handle_copy}
                      className="knowledge-diff-secondary knowledge-diff-copy-button"
                      style={{
                        padding: '8px 16px',
                        background: copied ? '#166534' : '#333',
                        color: copied ? '#86efac' : '#e0e0e0',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                  <textarea
                    value={result.appendix}
                    readOnly
                    style={{
                      width: '100%',
                      height: '300px',
                      padding: '12px',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#e0e0e0',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}

              {/* Analysis details */}
              <details open={!result.has_losses}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#bbb',
                  fontSize: '13px'
                }}>
                  {result.has_losses ? 'View analysis' : 'Analysis summary'}
                </summary>
                <pre style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#ccc',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto'
                }}>
                  {result.analysis}
                </pre>
              </details>
            </div>
          </div>
        )}
        <style jsx>{`
          @media (max-width: 768px) {
            .knowledge-diff-grid {
              grid-template-columns: 1fr !important;
            }

            .knowledge-diff-actions {
              flex-direction: column;
              align-items: stretch !important;
              gap: 12px !important;
            }

            .knowledge-diff-primary,
            .knowledge-diff-secondary {
              width: 100%;
            }

            .knowledge-diff-primary {
              padding: 14px !important;
            }

            .knowledge-diff-secondary {
              padding: 10px 14px !important;
              background: #333 !important;
              border-color: #555 !important;
              color: #ccc !important;
            }

            .knowledge-diff-option {
              width: 100%;
              justify-content: flex-start;
            }

            .knowledge-diff-appendix-header {
              flex-direction: column;
              align-items: stretch !important;
              gap: 12px;
            }

            .knowledge-diff-copy-button {
              text-align: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
