import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Frogger' };

export default function FroggerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
