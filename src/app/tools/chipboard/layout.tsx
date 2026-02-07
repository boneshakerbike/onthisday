import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chipboard' };

export default function ChipboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
