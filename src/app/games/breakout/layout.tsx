import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Breakout' };

export default function BreakoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
