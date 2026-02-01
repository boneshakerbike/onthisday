import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Frogger | 8i11' };

export default function FroggerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
