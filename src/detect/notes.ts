import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type NoteHit = {
  name: string;
  kind: 'file' | 'dir';
  summary: string | null;
};

const NAME_PATTERNS: Array<{ match: (n: string) => boolean; priority: number }> = [
  { match: (n) => /^STATE(\.md)?$/i.test(n), priority: 1 },
  { match: (n) => /^TODO(S)?(\.md)?$/i.test(n), priority: 2 },
  { match: (n) => /^ROADMAP(\.md)?$/i.test(n), priority: 3 },
  { match: (n) => /^CHANGELOG(\.md)?$/i.test(n), priority: 4 },
  { match: (n) => /^CHANGES(\.md)?$/i.test(n), priority: 4 },
  { match: (n) => /^HISTORY(\.md)?$/i.test(n), priority: 4 },
  { match: (n) => /^SPEC(-.+)?\.md$/i.test(n), priority: 5 },
  { match: (n) => /^0[0-9]-.+\.md$/i.test(n), priority: 5 },
  { match: (n) => /^ARCHITECTURE(\.md)?$/i.test(n), priority: 6 },
  { match: (n) => /^CONTRIBUTING(\.md)?$/i.test(n), priority: 7 },
  { match: (n) => /^SECURITY(\.md)?$/i.test(n), priority: 7 },
  { match: (n) => /^CODE_OF_CONDUCT(\.md)?$/i.test(n), priority: 7 },
  { match: (n) => /^CLAUDE\.md$/i.test(n), priority: 8 },
  { match: (n) => /^AGENTS\.md$/i.test(n), priority: 8 },
];

const DIR_PATTERNS: Array<{ match: (n: string) => boolean; priority: number }> = [
  { match: (n) => /^adrs?$/i.test(n), priority: 6 },
  { match: (n) => /^docs?$/i.test(n), priority: 9 },
];

function stripInlineMd(line: string): string {
  return line
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Single-underscore italic (`_text_`). Lookbehind/lookahead require
    // non-word boundaries on both sides so intraword underscores in tokens
    // like `CODE_OF_CONDUCT` or `tool_v2` aren't mistaken for emphasis.
    .replace(/(?<![A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1')
    // Images before links: ![alt](url) → alt, ![](url) → ''. Order matters:
    // the link regex would otherwise leave a stray '!' in front of the alt.
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function firstMeaningfulLine(path: string): string | null {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  const lines = raw.split(/\r?\n/);
  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i]?.trim() !== '---') i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const l = lines[i]?.trim() ?? '';
    if (!l) continue;
    // Skip fenced code blocks: the opening fence isn't meaningful prose, and
    // surfacing "```" or "```ts" as the summary is worse than digging past
    // it to the next real line.
    const fence = l.match(/^(`{3,}|~{3,})/);
    if (fence && fence[1]) {
      const marker = fence[1];
      i++;
      while (i < lines.length && !(lines[i]?.trim().startsWith(marker))) i++;
      continue;
    }
    const h = l.match(/^#{1,6}\s+(.+)$/);
    const text = stripInlineMd((h ? h[1] : l) ?? '');
    if (text.length === 0) continue;
    return text.length > 80 ? text.slice(0, 77) + '…' : text;
  }
  return null;
}

function countDirEntries(path: string): number {
  try {
    return readdirSync(path).filter((n: string) => !n.startsWith('.')).length;
  } catch {
    return 0;
  }
}

export function detectNotes(root: string): NoteHit[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  const hits: Array<NoteHit & { priority: number }> = [];

  for (const name of entries) {
    const full = join(root, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (!isDir) {
      for (const p of NAME_PATTERNS) {
        if (p.match(name)) {
          hits.push({
            name,
            kind: 'file',
            summary: firstMeaningfulLine(full),
            priority: p.priority,
          });
          break;
        }
      }
    } else {
      for (const p of DIR_PATTERNS) {
        if (p.match(name)) {
          const count = countDirEntries(full);
          hits.push({
            name: `${name}/`,
            kind: 'dir',
            summary: count > 0 ? `(${count} entries)` : '(empty)',
            priority: p.priority,
          });
          break;
        }
      }
    }
  }

  hits.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  return hits.map(({ name, kind, summary }) => ({ name, kind, summary }));
}
