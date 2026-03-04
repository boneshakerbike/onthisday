/**
 * Shared tool metadata — single source of truth for all tool listings.
 * Used by: home page (src/app/page.tsx), tools landing (src/app/tools/page.tsx),
 * and nav dropdown (src/components/nav_tabs.tsx).
 *
 * Adding a tool here automatically updates all three surfaces.
 */

export interface ToolMeta {
  /** Display label used in nav dropdowns and home page mini-links */
  label: string;
  /** Route path */
  path: string;
  /** Short description shown on the tools landing page */
  description: string;
}

export const TOOLS: ToolMeta[] = [
  {
    label: 'What Am I Trying To Say',
    path: '/tools/text-cleaner',
    description: 'Clean up rough text for clarity, then turn it into a three-paragraph story',
  },
  {
    label: 'Markdown Converter',
    path: '/tools/markdown',
    description: 'Convert rich text to Markdown and back',
  },
  {
    label: 'Instruction Stripper',
    path: '/tools/instruction-stripper',
    description: 'Strip formatting instructions and meta-commentary from AI-generated text',
  },
  {
    label: 'Knowledge Diff',
    path: '/tools/knowledge-diff',
    description: 'Compare knowledge documents to detect information loss',
  },
  {
    label: 'Prompt Library',
    path: '/tools/prompt-library',
    description: 'Store, tag, version, and review prompts with AI assistance',
  },
];
