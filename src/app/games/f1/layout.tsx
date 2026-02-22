import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'F1 Predictions' };

export default function F1Layout({ children }: { children: React.ReactNode }) {
  return children;
}
