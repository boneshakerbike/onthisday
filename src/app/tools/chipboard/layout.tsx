import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chipboard | 8i11' };

export default function ChipboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
