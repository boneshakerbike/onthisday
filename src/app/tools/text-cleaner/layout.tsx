import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '8i11 | What Am I Trying To Say',
};

export default function TextCleanerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
