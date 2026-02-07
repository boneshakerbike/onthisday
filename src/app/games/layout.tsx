import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '8i11 | %s',
    default: 'Games',
  },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
