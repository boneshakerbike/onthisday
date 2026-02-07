import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Markdown' };

export default function MarkdownLayout({ children }: { children: React.ReactNode }) {
  return children;
}
