import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Knowledge Diff',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
