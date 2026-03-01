/**
 * Markdown Converter Tool
 * Convert rich text to Markdown and vice versa
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import NavTabs from '@/components/nav_tabs';

export default function MarkdownConverterPage() {
  const [rich_content, set_rich_content] = useState('');
  const [markdown_content, set_markdown_content] = useState('');
  const [is_updating_from_rich, set_is_updating_from_rich] = useState(false);
  const [is_updating_from_markdown, set_is_updating_from_markdown] = useState(false);
  const [copy_status, set_copy_status] = useState<string | null>(null);
  const [docx_status, set_docx_status] = useState<string | null>(null);
  const [docx_importing, set_docx_importing] = useState(false);
  const rich_editor_ref = useRef<HTMLDivElement>(null);
  const markdown_timeout_ref = useRef<NodeJS.Timeout | null>(null);
  const rich_timeout_ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (rich_timeout_ref.current) clearTimeout(rich_timeout_ref.current);
      if (markdown_timeout_ref.current) clearTimeout(markdown_timeout_ref.current);
    };
  }, []);

  // HTML to Markdown converter
  const html_to_markdown = (html: string): string => {
    if (!html.trim()) return '';

    const temp_div = document.createElement('div');
    temp_div.innerHTML = html;

    const process_node = (node: Node, depth: number = 0): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tag_name = element.tagName.toLowerCase();
        const indent = '  '.repeat(depth);
        const children = Array.from(node.childNodes).map(child => process_node(child, depth)).join('');

        switch (tag_name) {
          case 'h1': return `# ${children.trim()}\n\n`;
          case 'h2': return `## ${children.trim()}\n\n`;
          case 'h3': return `### ${children.trim()}\n\n`;
          case 'h4': return `#### ${children.trim()}\n\n`;
          case 'h5': return `##### ${children.trim()}\n\n`;
          case 'h6': return `###### ${children.trim()}\n\n`;
          case 'p': return children.trim() ? `${children.trim()}\n\n` : '';
          case 'strong':
          case 'b': return `**${children}**`;
          case 'em':
          case 'i': return `*${children}*`;
          case 'u': return `<u>${children}</u>`;
          case 'a':
            const href = element.getAttribute('href');
            return href ? `[${children}](${href})` : children;
          case 'br': return '\n';
          case 'hr': return '\n---\n\n';
          case 'ul':
            const items = Array.from(element.children)
              .filter(child => child.tagName.toLowerCase() === 'li')
              .map(li => {
                const li_children = Array.from(li.childNodes)
                  .map(child => {
                    if ((child as HTMLElement).tagName?.toLowerCase() === 'ul') {
                      return '\n' + process_node(child, depth + 1);
                    }
                    return process_node(child, depth);
                  })
                  .join('')
                  .trim();
                return `${indent}- ${li_children}`;
              })
              .filter(item => item.length > indent.length + 2);
            return items.length > 0 ? items.join('\n') + '\n\n' : '';
          case 'ol':
            const numbered_items = Array.from(element.children)
              .filter(child => child.tagName.toLowerCase() === 'li')
              .map((li, index) => {
                const li_children = Array.from(li.childNodes)
                  .map(child => {
                    if ((child as HTMLElement).tagName?.toLowerCase() === 'ol') {
                      return '\n' + process_node(child, depth + 1);
                    }
                    return process_node(child, depth);
                  })
                  .join('')
                  .trim();
                return `${indent}${index + 1}. ${li_children}`;
              })
              .filter(item => item.length > indent.length + 3);
            return numbered_items.length > 0 ? numbered_items.join('\n') + '\n\n' : '';
          case 'li': return '';
          default: return children;
        }
      }

      return '';
    };

    let markdown = process_node(temp_div);
    markdown = markdown.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    return markdown;
  };

  // Markdown to HTML converter
  const markdown_to_html = (markdown: string): string => {
    if (!markdown.trim()) return '';

    const lines = markdown.split('\n');
    let html = '';
    let in_list = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed_line = line.trim();

      if (!trimmed_line) {
        if (in_list) {
          html += '</ul>';
          in_list = false;
        }
        html += '<br>';
        continue;
      }

      // Headers
      if (trimmed_line.startsWith('#')) {
        if (in_list) { html += '</ul>'; in_list = false; }
        const match = trimmed_line.match(/^#+/);
        const level = match ? match[0].length : 1;
        const text = trimmed_line.replace(/^#+\s*/, '');
        html += `<h${level}>${text}</h${level}>`;
        continue;
      }

      // Horizontal rules
      if (trimmed_line === '---') {
        if (in_list) { html += '</ul>'; in_list = false; }
        html += '<hr>';
        continue;
      }

      // Bullet lists
      if (trimmed_line.startsWith('- ')) {
        if (!in_list) { html += '<ul>'; in_list = true; }
        const text = trimmed_line.substring(2);
        html += `<li>${text}</li>`;
        continue;
      }

      // Regular text
      if (in_list) { html += '</ul>'; in_list = false; }

      let processed_line = trimmed_line;
      processed_line = processed_line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      processed_line = processed_line.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      processed_line = processed_line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

      html += `<p>${processed_line}</p>`;
    }

    if (in_list) html += '</ul>';
    return html;
  };

  // Handle rich text editor changes
  const handle_rich_text_change = () => {
    if (rich_editor_ref.current && !is_updating_from_markdown) {
      const html = rich_editor_ref.current.innerHTML;
      set_rich_content(html);

      if (rich_timeout_ref.current) clearTimeout(rich_timeout_ref.current);

      rich_timeout_ref.current = setTimeout(() => {
        set_is_updating_from_rich(true);
        const markdown = html_to_markdown(html);
        set_markdown_content(markdown);
        set_is_updating_from_rich(false);
      }, 300);
    }
  };

  // Handle markdown changes
  const handle_markdown_change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const markdown = e.target.value;
    set_markdown_content(markdown);

    if (!is_updating_from_rich) {
      if (markdown_timeout_ref.current) clearTimeout(markdown_timeout_ref.current);

      markdown_timeout_ref.current = setTimeout(() => {
        try {
          set_is_updating_from_markdown(true);
          if (rich_editor_ref.current) {
            const html = markdown_to_html(markdown);
            rich_editor_ref.current.innerHTML = html;
            set_rich_content(html);
          }
        } finally {
          set_is_updating_from_markdown(false);
        }
      }, 300);
    }
  };

  // Apply formatting
  const apply_format = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value || undefined);
    handle_rich_text_change();
    rich_editor_ref.current?.focus();
  };

  // Clear functions
  const clear_rich_text = () => {
    if (rich_editor_ref.current) {
      rich_editor_ref.current.innerHTML = '';
      set_rich_content('');
      set_markdown_content('');
    }
  };

  const clear_markdown = () => {
    set_markdown_content('');
    if (rich_editor_ref.current) {
      rich_editor_ref.current.innerHTML = '';
      set_rich_content('');
    }
  };

  // Copy markdown
  const copy_markdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown_content);
      set_copy_status('Copied!');
      setTimeout(() => set_copy_status(null), 2000);
    } catch {
      set_copy_status('Copy failed');
      setTimeout(() => set_copy_status(null), 2000);
    }
  };

  // Insert link
  const insert_link = () => {
    const url = prompt('Enter URL:');
    if (url) apply_format('createLink', url);
  };

  const handle_docx_upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    set_docx_status('Importing...');
    set_docx_importing(true);

    try {
      const array_buffer = await file.arrayBuffer();
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: array_buffer });
      const html = result.value || '';

      if (rich_editor_ref.current) {
        set_is_updating_from_markdown(true);
        rich_editor_ref.current.innerHTML = html;
        set_rich_content(html);
        const markdown = html_to_markdown(html);
        set_markdown_content(markdown);
        set_is_updating_from_markdown(false);
      }

      set_docx_status('Imported');
      setTimeout(() => set_docx_status(null), 2000);
    } catch (error) {
      console.error('Docx import failed:', error);
      set_docx_status('Import failed');
      setTimeout(() => set_docx_status(null), 3000);
    } finally {
      set_docx_importing(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 p-5">
      <div className="max-w-6xl mx-auto">
        <NavTabs />

        <h1 className="text-center text-3xl font-light text-cyan-400 mb-2">
          Markdown Converter
        </h1>
        <p className="text-center text-gray-400 mb-6">
          Real-time conversion between rich text and Markdown
        </p>

        {/* Copy status toast */}
        {copy_status && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            {copy_status}
          </div>
        )}
        {docx_status && (
          <div className="fixed top-14 right-4 bg-cyan-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            {docx_status}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-6">
          <label className="w-full sm:w-auto text-center px-4 py-2.5 sm:py-2 bg-[#333] sm:bg-white/10 hover:bg-cyan-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all cursor-pointer">
            Import .docx
            <input
              type="file"
              accept=".docx"
              onChange={handle_docx_upload}
              disabled={docx_importing}
              className="hidden"
            />
          </label>
          <span className="text-xs text-gray-400">Converts .docx → HTML → Markdown</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rich Text Editor */}
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden min-w-0">
            <div className="bg-white/5 px-4 py-2 border-b border-white/10">
              <h3 className="font-medium text-gray-300">Rich Text Editor</h3>
            </div>

            {/* Toolbar */}
            <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex flex-wrap gap-2">
              <button
                onClick={() => apply_format('bold')}
                className="px-3 py-1 bg-white/10 hover:bg-cyan-400/20 rounded border border-white/20 text-sm font-bold transition-all"
                title="Bold"
              >
                B
              </button>
              <button
                onClick={() => apply_format('italic')}
                className="px-3 py-1 bg-white/10 hover:bg-cyan-400/20 rounded border border-white/20 text-sm italic transition-all"
                title="Italic"
              >
                I
              </button>
              <button
                onClick={() => apply_format('underline')}
                className="px-3 py-1 bg-white/10 hover:bg-cyan-400/20 rounded border border-white/20 text-sm underline transition-all"
                title="Underline"
              >
                U
              </button>
              <button
                onClick={() => apply_format('insertOrderedList')}
                className="px-3 py-1 bg-white/10 hover:bg-cyan-400/20 rounded border border-white/20 text-sm transition-all"
                title="Numbered List"
              >
                1.
              </button>
              <button
                onClick={() => apply_format('insertUnorderedList')}
                className="px-3 py-1 bg-white/10 hover:bg-cyan-400/20 rounded border border-white/20 text-sm transition-all"
                title="Bullet List"
              >
                •
              </button>
              <button
                onClick={insert_link}
                className="px-3 py-1 bg-white/10 hover:bg-cyan-400/20 rounded border border-white/20 text-sm transition-all"
                title="Insert Link"
              >
                Link
              </button>
              <button
                onClick={clear_rich_text}
                className="px-3 py-1 bg-white/10 hover:bg-red-400/20 rounded border border-white/20 text-sm transition-all"
                title="Clear"
              >
                Clear
              </button>
            </div>

            {/* Editor */}
            <div
              ref={rich_editor_ref}
              contentEditable
              className="p-4 min-h-[400px] focus:outline-none prose prose-invert prose-sm max-w-none bg-white/5 overflow-x-auto break-words [&_img]:max-w-full [&_img]:h-auto"
              onInput={handle_rich_text_change}
              style={{ minHeight: '400px', overflowWrap: 'break-word', wordBreak: 'break-word' }}
            />
          </div>

          {/* Markdown Output */}
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden min-w-0">
            <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-medium text-gray-300">Markdown</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={copy_markdown}
                  className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-cyan-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  title="Copy"
                >
                  Copy
                </button>
                <button
                  onClick={clear_markdown}
                  className="px-3 py-2 sm:py-1 bg-[#333] sm:bg-white/10 hover:bg-red-400/20 rounded border border-[#555] sm:border-white/20 text-sm text-gray-300 transition-all"
                  title="Clear"
                >
                  Clear
                </button>
              </div>
            </div>

            <textarea
              value={markdown_content}
              onChange={handle_markdown_change}
              className="w-full p-4 font-mono text-sm resize-none focus:outline-none bg-transparent text-gray-200"
              style={{ minHeight: '456px' }}
              placeholder="Markdown output will appear here..."
            />
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-400 text-center">
          Supports headers, paragraphs, bold, italic, links, and lists.
        </p>
      </div>
    </div>
  );
}
