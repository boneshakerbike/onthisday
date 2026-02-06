'use client';

/**
 * Knowledge Diff Tool
 * Compares two knowledge documents for potential information loss
 */

import { useState, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

interface UsageInfo {
  analysis_input: number;
  analysis_output: number;
  merge_input: number;
  merge_output: number;
}

interface DiffResult {
  success: boolean;
  complete: boolean;
  message: string;
  analysis_summary?: string;
  gaps_found?: string;
  merged_document?: string;
  usage: UsageInfo;
}

export default function KnowledgeDiffPage() {
  const [old_doc, set_old_doc] = useState('');
  const [new_doc, set_new_doc] = useState('');
  const [use_opus, set_use_opus] = useState(false);
  const [loading, set_loading] = useState(false);
  const [result, set_result] = useState<DiffResult | null>(null);
  const [error, set_error] = useState('');
  const [copied, set_copied] = useState(false);
  const [is_localhost, set_is_localhost] = useState(false);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
  }, []);

  async function handle_compare() {
    if (!old_doc.trim() || !new_doc.trim()) {
      set_error('Please paste both documents');
      return;
    }

    set_loading(true);
    set_error('');
    set_result(null);

    try {
      const response = await fetch('/api/knowledge-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_doc, new_doc, use_opus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Comparison failed');
      }

      set_result(data);
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      set_loading(false);
    }
  }

  async function handle_copy() {
    if (result?.merged_document) {
      await navigator.clipboard.writeText(result.merged_document);
      set_copied(true);
      setTimeout(() => set_copied(false), 2000);
    }
  }

  function calculate_cost(usage: UsageInfo): string {
    // Sonnet: $3/M in, $15/M out
    // Opus: $15/M in, $75/M out
    const sonnet_cost = (usage.analysis_input * 3 + usage.analysis_output * 15) / 1_000_000;

    let merge_cost = 0;
    if (usage.merge_input > 0) {
      if (use_opus) {
        merge_cost = (usage.merge_input * 15 + usage.merge_output * 75) / 1_000_000;
      } else {
        // Using Sonnet for merge (Haiku was returning 404)
        merge_cost = (usage.merge_input * 3 + usage.merge_output * 15) / 1_000_000;
      }
    }

    return (sonnet_cost + merge_cost).toFixed(4);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
        <NavTabs is_localhost={is_localhost} />

        <h1 style={{ fontSize: '1.5em', marginBottom: '8px' }}>Knowledge Diff</h1>
        <p style={{ color: '#888', marginBottom: '24px' }}>
          Compare two knowledge documents to detect potential information loss
        </p>

        <div style={{
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
              color: '#aaa'
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
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {old_doc.length.toLocaleString()} characters
            </div>
          </div>

          {/* New Document */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 500,
              color: '#aaa'
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
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {new_doc.length.toLocaleString()} characters
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '24px'
        }}>
          <button
            onClick={handle_compare}
            disabled={loading || !old_doc.trim() || !new_doc.trim()}
            style={{
              padding: '12px 32px',
              background: loading ? '#333' : '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
              opacity: (!old_doc.trim() || !new_doc.trim()) ? 0.5 : 1
            }}
          >
            {loading ? 'Comparing...' : 'Compare'}
          </button>

          <button
            onClick={() => { set_old_doc(''); set_new_doc(''); set_result(null); set_error(''); }}
            disabled={loading || (!old_doc && !new_doc && !result)}
            style={{
              padding: '12px 24px',
              background: '#333',
              color: '#aaa',
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

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#888',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={use_opus}
              onChange={(e) => set_use_opus(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Use Opus 4.5 for merge (highest quality, ~5x cost)
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
            border: `1px solid ${result.complete ? '#166534' : '#854d0e'}`,
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              background: result.complete ? '#14532d' : '#422006',
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
                  {result.complete ? '✓' : '⚠'}
                </span>
                <div>
                  <div style={{
                    fontWeight: 600,
                    color: result.complete ? '#86efac' : '#fde047'
                  }}>
                    {result.complete ? 'New document is complete' : 'Gaps found and merged'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#888' }}>
                    {result.message}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                color: '#666',
                textAlign: 'right'
              }}>
                <div>Cost: ${calculate_cost(result.usage)}</div>
                <div>
                  {(result.usage.analysis_input + result.usage.merge_input).toLocaleString()} in / {' '}
                  {(result.usage.analysis_output + result.usage.merge_output).toLocaleString()} out
                </div>
              </div>
            </div>

            {/* Analysis summary when complete (no gaps) */}
            {result.complete && result.analysis_summary && (
              <div style={{ padding: '20px' }}>
                <pre style={{
                  padding: '12px',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#aaa',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto'
                }}>
                  {result.analysis_summary}
                </pre>
              </div>
            )}

            {/* Merged Document */}
            {result.merged_document && (
              <div style={{ padding: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <label style={{ fontWeight: 500, color: '#aaa' }}>
                    Merged Document (copy this)
                  </label>
                  <button
                    onClick={handle_copy}
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
                  value={result.merged_document}
                  readOnly
                  style={{
                    width: '100%',
                    height: '400px',
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

                {/* Gaps detail (collapsible) */}
                {result.gaps_found && (
                  <details style={{ marginTop: '16px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      color: '#888',
                      fontSize: '13px'
                    }}>
                      View detected gaps
                    </summary>
                    <pre style={{
                      marginTop: '8px',
                      padding: '12px',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#aaa',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto'
                    }}>
                      {result.gaps_found}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
