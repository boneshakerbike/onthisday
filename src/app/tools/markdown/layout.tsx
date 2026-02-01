import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Markdown | 8i11' };

export default function MarkdownLayout({ children }: { children: React.ReactNode }) {
  return children;
}
