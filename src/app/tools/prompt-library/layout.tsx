import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prompt Library',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
