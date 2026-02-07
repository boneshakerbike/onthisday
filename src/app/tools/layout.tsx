import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '8i11 | %s',
    default: 'Tools',
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
