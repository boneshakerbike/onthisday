import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '8i11 | Say What?',
};

export default function TextCleanerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
