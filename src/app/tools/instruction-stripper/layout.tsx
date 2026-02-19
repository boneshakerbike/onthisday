import type { Metadata } from 'next';

export const metadata: Metadata = { title: '8i11 | Instruction Stripper' };

export default function InstructionStripperLayout({ children }: { children: React.ReactNode }) {
  return children;
}
