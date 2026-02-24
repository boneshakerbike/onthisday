import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function get_ts_files(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '__tests__') {
      results.push(...get_ts_files(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('AI SDK centralization', () => {
  it('only src/lib/ai.ts may import @anthropic-ai/sdk', () => {
    const src_dir = path.resolve(__dirname, '..');
    const files = get_ts_files(src_dir);
    const allowed = path.resolve(src_dir, 'lib', 'ai.ts');
    const violations: string[] = [];

    for (const file of files) {
      if (path.resolve(file) === allowed) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes("from '@anthropic-ai/sdk'") || content.includes('from "@anthropic-ai/sdk"')) {
        violations.push(path.relative(src_dir, file));
      }
    }

    expect(violations, `These files import @anthropic-ai/sdk directly:\n${violations.join('\n')}`).toEqual([]);
  });
});
